import { IsNotEmpty, IsString } from "class-validator";
import { Tool } from "../interfaces/Tool.js";
import { PluginTaskPrintText, PluginTaskPrintTextParams } from "../interfaces/PluginTask.js";
import type { ToolResponse } from "../interfaces/ToolResponse.js";
import { TextResponse } from "../interfaces/ToolResponse.js";
import "reflect-metadata";
import { PenpotMcpServer } from "../index.js";

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
    /**
     * Creates a new PrintText tool instance.
     *
     * @param mcpServer - The MCP server instance
     */
    constructor(mcpServer: PenpotMcpServer) {
        super(mcpServer, PrintTextArgs);
    }

    protected getToolName(): string {
        return "print_text";
    }

    protected getToolDescription(): string {
        return "Creates text in Penpot at the viewport center and selects it";
    }

    protected async executeCore(args: PrintTextArgs): Promise<ToolResponse> {
        const taskParams = new PluginTaskPrintTextParams(args.text);
        const task = new PluginTaskPrintText(taskParams);
        this.mcpServer.executePluginTask(task);
        return new TextResponse(
            `Successfully sent text creation task. Text "${args.text}" should now appear in Penpot.`
        );
    }
}
