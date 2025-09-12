import { WebSocket, WebSocketServer } from "ws";
import { PluginTask } from "./PluginTask";
import { PluginTaskResponse, PluginTaskResult } from "@penpot-mcp/common";

/**
 * Provides the connection to the Penpot MCP Plugin via WebSocket
 */
export class PluginBridge {
    private readonly wsServer: WebSocketServer;
    private readonly connectedClients: Set<WebSocket> = new Set();
    private readonly pendingTasks: Map<string, PluginTask<any, any>> = new Map();
    private readonly taskTimeouts: Map<string, NodeJS.Timeout> = new Map();

    constructor(port: number) {
        this.wsServer = new WebSocketServer({ port: port });
        this.setupWebSocketHandlers();
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
            const error = new Error(response.result.error || "Task execution failed");
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
    public async executePluginTask<TResult extends PluginTaskResult>(task: PluginTask<any, TResult>): Promise<void> {
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
        }, 30000);

        this.taskTimeouts.set(task.id, timeoutHandle);
        console.error(`Sent task ${task.id} to ${sentCount} connected clients`);
    }
}
