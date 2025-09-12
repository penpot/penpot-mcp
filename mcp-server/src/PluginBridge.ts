#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, CallToolResult, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { WebSocket, WebSocketServer } from "ws";

import { ToolInterface } from "./Tool";
import { HelloWorldTool } from "./tools/HelloWorldTool";
import { PrintTextTool } from "./tools/PrintTextTool";
import { PluginTask } from "./PluginTask";
import { PluginTaskResponse, PluginTaskResult } from '@penpot-mcp/common';

/**
 * Penpot MCP server implementation with HTTP and SSE Transport Support
 */
export class PenpotMcpServer {
    private readonly server: Server;
    private readonly tools: Map<string, ToolInterface>;
    private readonly wsServer: WebSocketServer;
    private readonly connectedClients: Set<WebSocket> = new Set();
    private readonly pendingTasks: Map<string, PluginTask<any, any>> = new Map();
    private readonly taskTimeouts: Map<string, NodeJS.Timeout> = new Map();
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

        this.tools = new Map<string, ToolInterface>();
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
                try {
                    const response: PluginTaskResponse = JSON.parse(data.toString());
                    this.handlePluginTaskResponse(response);
                } catch (error) {
                    console.error("Failed to parse WebSocket message:", error);
                }
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
     * Handles responses from the plugin for completed tasks.
     * 
     * Finds the pending task by ID and resolves or rejects its promise
     * based on the execution result.
     * 
     * @param response - The plugin task response containing ID and result
     */
    private handlePluginTaskResponse(response: PluginTaskResponse): void {
        const task = this.pendingTasks.get(response.id);
        if (!task) {
            console.error(`Received response for unknown task ID: ${response.id}`);
            return;
        }

        // Clear the timeout and remove the task from pending tasks
        const timeoutHandle = this.taskTimeouts.get(response.id);
        if (timeoutHandle) {
            clearTimeout(timeoutHandle);
            this.taskTimeouts.delete(response.id);
        }
        this.pendingTasks.delete(response.id);

        // Resolve or reject the task's promise based on the result
        if (response.result.success) {
            task.resolveWithResult(response.result);
        } else {
            const error = new Error(response.result.error || 'Task execution failed');
            task.rejectWithError(error);
        }

        console.error(`Task ${response.id} completed with success: ${response.result.success}`);
    }

    /**
     * Executes a plugin task by sending it to connected clients.
     * 
     * Registers the task for result correlation and returns a promise
     * that resolves when the plugin responds with the execution result.
     * 
     * @param task - The plugin task to execute
     * @throws Error if no plugin instances are connected or available
     */
    public async executePluginTask<TResult extends PluginTaskResult>(
        task: PluginTask<any, TResult>
    ): Promise<void> {
        // Check if there are connected clients
        if (this.connectedClients.size === 0) {
            throw new Error(
                `No Penpot plugin instances are currently connected. Please ensure the plugin is running and connected.`
            );
        }

        // Register the task for result correlation
        this.pendingTasks.set(task.id, task);

        // Send task to all connected clients using the new request format
        const requestMessage = JSON.stringify(task.toRequest());
        let sentCount = 0;
        this.connectedClients.forEach((client) => {
            if (client.readyState === 1) {
                // WebSocket.OPEN
                client.send(requestMessage);
                sentCount++;
            }
        });
        
        if (sentCount === 0) {
            // Clean up the pending task and timeout since we couldn't send it
            this.pendingTasks.delete(task.id);
            const timeoutHandle = this.taskTimeouts.get(task.id);
            if (timeoutHandle) {
                clearTimeout(timeoutHandle);
                this.taskTimeouts.delete(task.id);
            }
            throw new Error(`All connected plugin instances appear to be disconnected. Task could not be sent.`);
        }

        // Set up a timeout to reject the task if no response is received
        const timeoutHandle = setTimeout(() => {
            const pendingTask = this.pendingTasks.get(task.id);
            if (pendingTask) {
                this.pendingTasks.delete(task.id);
                this.taskTimeouts.delete(task.id);
                pendingTask.rejectWithError(new Error(`Task ${task.id} timed out after 30 seconds`));
            }
        }, 30000); // 30 second timeout

        this.taskTimeouts.set(task.id, timeoutHandle);
        console.error(`Sent task ${task.id} to ${sentCount} connected clients`);
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
