import { IsNotEmpty, IsString } from "class-validator";
import { Tool } from "../Tool";
import type { ToolResponse } from "../ToolResponse";
import { TextResponse } from "../ToolResponse";
import "reflect-metadata";
import { PenpotMcpServer } from "../PenpotMcpServer";
import { PrintTextPluginTask, PrintTextPluginTaskParams } from "../tasks/PrintTextPluginTask";

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
        const taskParams = new PrintTextPluginTaskParams(args.text);
        const task = new PrintTextPluginTask(taskParams);
        this.mcpServer.executePluginTask(task);
        return new TextResponse(
            `Successfully sent text creation task. Text "${args.text}" should now appear in Penpot.`
        );
    }
}
