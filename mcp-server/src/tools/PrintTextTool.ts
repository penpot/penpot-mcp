import { IsNotEmpty, IsString } from "class-validator";
import { Tool } from "../interfaces/Tool.js";
import { PluginTaskPrintText, PluginTaskPrintTextParams } from "../interfaces/PluginTask.js";
import type { ToolResponse } from "../interfaces/ToolResponse.js";
import { TextResponse } from "../interfaces/ToolResponse.js";
import "reflect-metadata";

/**
 * Arguments class for the PrintText tool with validation decorators.
 */
export class PrintTextArgs {
    /**
     * The text to create in Penpot.
     */
    @IsString({ message: "Text must be a string" })
    @IsNotEmpty({ message: "Text cannot be empty" })
    text!: string;
}

/**
 * Tool for creating text elements in Penpot via WebSocket communication.
 *
 * This tool sends a PluginTaskPrintText to connected plugin instances,
 * instructing them to create and position text elements in the canvas.
 */
export class PrintTextTool extends Tool<PrintTextArgs> {
    private connectedClients: Set<any>; // WebSocket clients

    /**
     * Creates a new PrintText tool instance.
     *
     * @param connectedClients - Set of connected WebSocket clients
     */
    constructor(connectedClients: Set<any>) {
        super(PrintTextArgs);
        this.connectedClients = connectedClients;
    }

    protected getToolName(): string {
        return "print_text";
    }

    protected getToolDescription(): string {
        return "Creates text in Penpot at the viewport center and selects it";
    }

    /**
     * Executes the print text functionality by sending a task to connected plugins.
     *
     * This method creates a PluginTaskPrintText and broadcasts it to all
     * connected WebSocket clients for execution.
     *
     * @param args - The validated PrintTextArgs instance
     */
    protected async executeCore(args: PrintTextArgs): Promise<ToolResponse> {
        try {
            // Create the plugin task
            const taskParams = new PluginTaskPrintTextParams(args.text);
            const task = new PluginTaskPrintText(taskParams);

            // Check if there are connected clients
            if (this.connectedClients.size === 0) {
                return new TextResponse(
                    `No Penpot plugin instances are currently connected. Please ensure the plugin is running and connected.`
                );
            }

            // Send task to all connected clients
            const taskMessage = JSON.stringify(task.toJSON());
            let sentCount = 0;

            this.connectedClients.forEach((client) => {
                if (client.readyState === 1) {
                    // WebSocket.OPEN
                    client.send(taskMessage);
                    sentCount++;
                }
            });

            if (sentCount === 0) {
                return new TextResponse(
                    `All connected plugin instances appear to be disconnected. No text was created.`
                );
            }

            return new TextResponse(
                `Successfully sent text creation task to ${sentCount} connected plugin instance(s). Text "${args.text}" should now appear in Penpot.`
            );
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            return new TextResponse(`Failed to create text in Penpot: ${errorMessage}`);
        }
    }
}
