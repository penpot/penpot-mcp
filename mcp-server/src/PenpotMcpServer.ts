import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { HelloWorldTool } from "./tools/HelloWorldTool";
import { PrintTextTool } from "./tools/PrintTextTool";
import { ExecuteCodeTool } from "./tools/ExecuteCodeTool";
import { PluginBridge } from "./PluginBridge";
import { ConfigurationLoader } from "./ConfigurationLoader";
import { createLogger } from "./logger";
import { Tool } from "./Tool";
import { HighLevelOverviewTool } from "./tools/HighLevelOverviewTool";
import { PenpotApiInfoTool } from "./tools/PenpotApiInfoTool";
import { ExportShapeTool } from "./tools/ExportShapeTool";
import { ReplServer } from "./ReplServer";

export class PenpotMcpServer {
    private readonly logger = createLogger("PenpotMcpServer");
    private readonly server: McpServer;
    private readonly tools: Map<string, Tool<any>>;
    public readonly configLoader: ConfigurationLoader;
    private app: any;
    public readonly pluginBridge: PluginBridge;
    private readonly replServer: ReplServer;

    private readonly transports = {
        streamable: {} as Record<string, StreamableHTTPServerTransport>,
        sse: {} as Record<string, SSEServerTransport>,
    };

    constructor(
        public port: number = 4401,
        public webSocketPort: number = 8080,
        replPort: number = 4403
    ) {
        this.configLoader = new ConfigurationLoader();

        const instructions = this.configLoader.getInitialInstructions();
        this.server = new McpServer(
            {
                name: "penpot-mcp-server",
                version: "1.0.0",
            },
            {
                instructions: instructions,
            }
        );

        this.tools = new Map<string, Tool<any>>();
        this.pluginBridge = new PluginBridge(webSocketPort);
        this.replServer = new ReplServer(this.pluginBridge, replPort);

        this.registerTools();
    }

    public getInitialInstructions(): string {
        return this.configLoader.getInitialInstructions();
    }

    private registerTools(): void {
        const toolInstances: Tool<any>[] = [
            new HelloWorldTool(this),
            new PrintTextTool(this),
            new ExecuteCodeTool(this),
            new HighLevelOverviewTool(this),
            new PenpotApiInfoTool(this),
            new ExportShapeTool(this),
        ];

        for (const tool of toolInstances) {
            const toolName = tool.getToolName();
            this.tools.set(toolName, tool);

            // Register each tool with McpServer
            this.logger.info(`Registering tool: ${toolName}`);
            this.server.registerTool(
                toolName,
                {
                    description: tool.getToolDescription(),
                    inputSchema: tool.getInputSchema(),
                },
                async (args) => {
                    return tool.execute(args);
                }
            );
        }
    }

    private setupHttpEndpoints(): void {
        this.app.all("/mcp", async (req: any, res: any) => {
            const { randomUUID } = await import("node:crypto");

            const sessionId = req.headers["mcp-session-id"] as string | undefined;
            let transport: StreamableHTTPServerTransport;

            if (sessionId && this.transports.streamable[sessionId]) {
                transport = this.transports.streamable[sessionId];
            } else {
                transport = new StreamableHTTPServerTransport({
                    sessionIdGenerator: () => randomUUID(),
                    onsessioninitialized: (id: string) => {
                        this.transports.streamable[id] = transport;
                    },
                });

                transport.onclose = () => {
                    if (transport.sessionId) {
                        delete this.transports.streamable[transport.sessionId];
                    }
                };

                await this.server.connect(transport);
            }

            await transport.handleRequest(req, res, req.body);
        });

        this.app.get("/sse", async (_req: any, res: any) => {
            const transport = new SSEServerTransport("/messages", res);
            this.transports.sse[transport.sessionId] = transport;

            res.on("close", () => {
                delete this.transports.sse[transport.sessionId];
            });

            await this.server.connect(transport);
        });

        this.app.post("/messages", async (req: any, res: any) => {
            const sessionId = req.query.sessionId as string;
            const transport = this.transports.sse[sessionId];

            if (transport) {
                await transport.handlePostMessage(req, res, req.body);
            } else {
                res.status(400).send("No transport found for sessionId");
            }
        });
    }

    async start(): Promise<void> {
        const { default: express } = await import("express");
        this.app = express();
        this.app.use(express.json());

        this.setupHttpEndpoints();

        return new Promise((resolve) => {
            this.app.listen(this.port, async () => {
                this.logger.info(`Penpot MCP Server started on port ${this.port}`);
                this.logger.info(`Modern Streamable HTTP endpoint: http://localhost:${this.port}/mcp`);
                this.logger.info(`Legacy SSE endpoint: http://localhost:${this.port}/sse`);
                this.logger.info(`WebSocket server is on ws://localhost:${this.webSocketPort}`);

                // start the REPL server
                await this.replServer.start();

                resolve();
            });
        });
    }

    /**
     * Stops the MCP server and associated services.
     *
     * Gracefully shuts down the REPL server and other components.
     */
    public async stop(): Promise<void> {
        this.logger.info("Stopping Penpot MCP Server...");
        await this.replServer.stop();
        this.logger.info("Penpot MCP Server stopped");
    }
}
