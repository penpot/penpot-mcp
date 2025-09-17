import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, CallToolResult, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

import { ToolInterface } from "./Tool";
import { HelloWorldTool } from "./tools/HelloWorldTool";
import { PrintTextTool } from "./tools/PrintTextTool";
import { PluginBridge } from "./PluginBridge";
import { createLogger } from "./logger";

/**
 * Penpot MCP server implementation with HTTP and SSE Transport Support
 */
export class PenpotMcpServer {
    private readonly logger = createLogger("PenpotMcpServer");
    private readonly server: Server;
    private readonly tools: Map<string, ToolInterface>;
    private app: any; // Express app
    private readonly port: number;
    public readonly pluginBridge: PluginBridge;

    // Store transports for each session type
    private readonly transports = {
        streamable: {} as Record<string, any>, // StreamableHTTPServerTransport
        sse: {} as Record<string, any>, // SSEServerTransport
    };

    /**
     * Creates a new Penpot MCP server instance.
     *
     * @param port - The port number for the HTTP/SSE server
     * @param webSocketPort - The port number for the plugin bridge's WebSocket server
     */
    constructor(port: number = 4401, webSocketPort: number = 8080) {
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

        this.tools = new Map<string, ToolInterface>();
        this.pluginBridge = new PluginBridge(webSocketPort);

        this.setupMcpHandlers();
        this.registerTools();
    }

    /**
     * Registers all available tools with the server.
     *
     * This method instantiates tool implementations and adds them to
     * the internal registry for later execution.
     */
    private registerTools(): void {
        const toolInstances: ToolInterface[] = [new HelloWorldTool(this), new PrintTextTool(this)];

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

        this.server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
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
                this.logger.info(`Penpot MCP Server started successfully on port ${this.port}`);
                this.logger.info(`Modern Streamable HTTP endpoint: http://localhost:${this.port}/mcp`);
                this.logger.info(`Legacy SSE endpoint: http://localhost:${this.port}/sse`);
                this.logger.info("WebSocket server is listening on ws://localhost:8080");
                resolve();
            });
        });
    }
}
