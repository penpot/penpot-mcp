#!/usr/bin/env node

/**
 * Penpot MCP Server with HTTP and SSE Transport Support
 *
 * This server implementation supports both modern Streamable HTTP and legacy SSE transports
 * instead of the traditional stdio transport. This provides better compatibility with
 * web-based MCP clients and allows for more flexible deployment scenarios.
 *
 * Transport Endpoints:
 * - Modern Streamable HTTP: POST/GET/DELETE /mcp
 * - Legacy SSE: GET /sse and POST /messages
 * - WebSocket (for plugin communication): ws://localhost:8080
 *
 * Usage:
 * - Default port: node dist/index.js (runs on 4401)
 * - Custom port: node dist/index.js --port 8080
 * - Help: node dist/index.js --help
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { WebSocketServer, WebSocket } from "ws";

import { Tool } from "./interfaces/Tool.js";
import { HelloWorldTool } from "./tools/HelloWorldTool.js";
import { ToolPrintText } from "./tools/ToolPrintText.js";

/**
 * Main MCP server implementation for Penpot integration.
 *
 * This server manages tool registration and execution using a clean
 * abstraction pattern that allows for easy extension with new tools.
 */
class PenpotMcpServer {
    private readonly server: Server;
    private readonly tools: Map<string, Tool>;
    private readonly wsServer: WebSocketServer;
    private readonly connectedClients: Set<WebSocket> = new Set();
    private app: any; // Express app
    private readonly port: number;

    // Store transports for each session type
    private readonly transports = {
        streamable: {} as Record<string, any>, // StreamableHTTPServerTransport
        sse: {} as Record<string, any>, // SSEServerTransport
    };

    /**
     * Creates a new Penpot MCP server instance.
     *
     * @param port - The port number for the HTTP/SSE server
     */
    constructor(port: number = 4401) {
        this.port = port;
        this.server = new Server(
            {
                name: "penpot-mcp-server",
                version: "1.0.0",
            },
            {
                capabilities: {
                    tools: {},
                },
            }
        );

        this.tools = new Map<string, Tool>();
        this.wsServer = new WebSocketServer({ port: 8080 });

        this.setupMcpHandlers();
        this.setupWebSocketHandlers();
        this.registerTools();
    }

    /**
     * Registers all available tools with the server.
     *
     * This method instantiates tool implementations and adds them to
     * the internal registry for later execution.
     */
    private registerTools(): void {
        const toolInstances: Tool[] = [new HelloWorldTool(), new ToolPrintText(this.connectedClients)];

        for (const tool of toolInstances) {
            this.tools.set(tool.definition.name, tool);
        }
    }

    /**
     * Sets up the MCP protocol request handlers.
     *
     * Configures handlers for tool listing and execution requests
     * according to the MCP specification.
     */
    private setupMcpHandlers(): void {
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            return {
                tools: Array.from(this.tools.values()).map((tool) => tool.definition),
            };
        });

        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;

            const tool = this.tools.get(name);
            if (!tool) {
                throw new Error(`Tool "${name}" not found`);
            }

            try {
                return await tool.execute(args);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : "Unknown error";
                throw new Error(`Tool execution failed: ${errorMessage}`);
            }
        });
    }

    /**
     * Sets up HTTP endpoints for modern Streamable HTTP and legacy SSE transports.
     *
     * Provides backwards compatibility by supporting both transport mechanisms
     * for different client capabilities.
     */
    private setupHttpEndpoints(): void {
        // Modern Streamable HTTP endpoint
        this.app.all("/mcp", async (req: any, res: any) => {
            await this.handleStreamableHttpRequest(req, res);
        });

        // Legacy SSE endpoint for older clients
        this.app.get("/sse", async (req: any, res: any) => {
            await this.handleSseConnection(req, res);
        });

        // Legacy message endpoint for older clients
        this.app.post("/messages", async (req: any, res: any) => {
            await this.handleSseMessage(req, res);
        });
    }

    /**
     * Handles Streamable HTTP requests for modern MCP clients.
     *
     * Provides session management and request routing for the new
     * streamable HTTP transport protocol.
     */
    private async handleStreamableHttpRequest(req: any, res: any): Promise<void> {
        const { StreamableHTTPServerTransport } = await import("@modelcontextprotocol/sdk/server/streamableHttp.js");
        const { randomUUID } = await import("node:crypto");
        const { isInitializeRequest } = await import("@modelcontextprotocol/sdk/types.js");

        // Check for existing session ID
        const sessionId = req.headers["mcp-session-id"] as string | undefined;
        let transport: any;

        if (sessionId && this.transports.streamable[sessionId]) {
            // Reuse existing transport
            transport = this.transports.streamable[sessionId];
        } else if (!sessionId && isInitializeRequest(req.body)) {
            // New initialization request
            transport = new StreamableHTTPServerTransport({
                sessionIdGenerator: () => randomUUID(),
                onsessioninitialized: (sessionId: string) => {
                    // Store the transport by session ID
                    this.transports.streamable[sessionId] = transport;
                },
                // DNS rebinding protection is disabled by default for backwards compatibility
                // If running locally, consider enabling:
                // enableDnsRebindingProtection: true,
                // allowedHosts: ['127.0.0.1'],
            });

            // Clean up transport when closed
            transport.onclose = () => {
                if (transport.sessionId) {
                    delete this.transports.streamable[transport.sessionId];
                }
            };

            // Connect to the MCP server
            await this.server.connect(transport);
        } else {
            // Invalid request
            res.status(400).json({
                jsonrpc: "2.0",
                error: {
                    code: -32000,
                    message: "Bad Request: No valid session ID provided",
                },
                id: null,
            });
            return;
        }

        // Handle the request
        await transport.handleRequest(req, res, req.body);
    }

    /**
     * Handles SSE connection establishment for legacy MCP clients.
     *
     * Creates and manages Server-Sent Events transport for older
     * clients that don't support the streamable HTTP protocol.
     */
    private async handleSseConnection(req: any, res: any): Promise<void> {
        const { SSEServerTransport } = await import("@modelcontextprotocol/sdk/server/sse.js");

        // Create SSE transport for legacy clients
        const transport = new SSEServerTransport("/messages", res);
        this.transports.sse[transport.sessionId] = transport;

        res.on("close", () => {
            delete this.transports.sse[transport.sessionId];
        });

        await this.server.connect(transport);
    }

    /**
     * Handles POST message requests for legacy SSE clients.
     *
     * Routes messages to the appropriate SSE transport based on
     * the provided session identifier.
     */
    private async handleSseMessage(req: any, res: any): Promise<void> {
        const sessionId = req.query.sessionId as string;
        const transport = this.transports.sse[sessionId];

        if (transport) {
            await transport.handlePostMessage(req, res, req.body);
        } else {
            res.status(400).send("No transport found for sessionId");
        }
    }

    /**
     * Sets up WebSocket connection handlers for plugin communication.
     *
     * Manages client connections and provides bidirectional communication
     * channel between the MCP server and Penpot plugin instances.
     */
    private setupWebSocketHandlers(): void {
        this.wsServer.on("connection", (ws: WebSocket) => {
            console.error("New WebSocket connection established");
            this.connectedClients.add(ws);

            ws.on("message", (data: Buffer) => {
                console.error("Received WebSocket message:", data.toString());
                // Protocol will be defined later
            });

            ws.on("close", () => {
                console.error("WebSocket connection closed");
                this.connectedClients.delete(ws);
            });

            ws.on("error", (error) => {
                console.error("WebSocket connection error:", error);
                this.connectedClients.delete(ws);
            });
        });

        console.error("WebSocket server started on port 8080");
    }

    /**
     * Starts the MCP server using HTTP and SSE transports.
     *
     * This method establishes the HTTP server and begins listening
     * for both modern and legacy MCP protocol connections.
     */
    async start(): Promise<void> {
        // Import express as ES module and setup HTTP endpoints
        const { default: express } = await import("express");
        this.app = express();
        this.app.use(express.json());

        this.setupHttpEndpoints();

        return new Promise((resolve) => {
            this.app.listen(this.port, () => {
                console.error(`Penpot MCP Server started successfully on port ${this.port}`);
                console.error(`Modern Streamable HTTP endpoint: http://localhost:${this.port}/mcp`);
                console.error(`Legacy SSE endpoint: http://localhost:${this.port}/sse`);
                console.error("WebSocket server is listening on ws://localhost:8080");
                resolve();
            });
        });
    }
}

/**
 * Application entry point.
 *
 * Creates and starts the MCP server instance, handling any startup errors
 * gracefully and ensuring proper process termination.
 */
async function main(): Promise<void> {
    try {
        // Parse command line arguments for port configuration
        const args = process.argv.slice(2);
        let port = 4401; // Default port

        for (let i = 0; i < args.length; i++) {
            if (args[i] === "--port" || args[i] === "-p") {
                if (i + 1 < args.length) {
                    const portArg = parseInt(args[i + 1], 10);
                    if (!isNaN(portArg) && portArg > 0 && portArg <= 65535) {
                        port = portArg;
                    } else {
                        console.error("Invalid port number. Using default port 4401.");
                    }
                }
            } else if (args[i] === "--help" || args[i] === "-h") {
                console.log("Usage: node dist/index.js [options]");
                console.log("Options:");
                console.log("  --port, -p <number>    Port number for the HTTP/SSE server (default: 4401)");
                console.log("  --help, -h             Show this help message");
                process.exit(0);
            }
        }

        const server = new PenpotMcpServer(port);
        await server.start();

        // Keep the process alive
        process.on("SIGINT", () => {
            console.error("Received SIGINT, shutting down gracefully...");
            process.exit(0);
        });

        process.on("SIGTERM", () => {
            console.error("Received SIGTERM, shutting down gracefully...");
            process.exit(0);
        });
    } catch (error) {
        console.error("Failed to start MCP server:", error);
        process.exit(1);
    }
}

// Start the server if this file is run directly
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1].endsWith("index.js")) {
    main().catch((error) => {
        console.error("Unhandled error in main:", error);
        process.exit(1);
    });
}
