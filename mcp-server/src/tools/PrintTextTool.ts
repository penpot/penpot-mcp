import { z } from "zod";
import { Tool } from "../Tool";
import type { ToolResponse } from "../ToolResponse";
import { TextResponse } from "../ToolResponse";
import "reflect-metadata";
import { PenpotMcpServer } from "../PenpotMcpServer";
import { PrintTextPluginTask } from "../tasks/PrintTextPluginTask";
import { PrintTextTaskParams } from "@penpot-mcp/common";

/**
 * Arguments class for the PrintText tool with validation decorators.
 */
export class PrintTextArgs {
    static schema = {
        text: z.string().min(1, "Text cannot be empty"),
    };

    /**
     * The text to create in Penpot.
     */
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
        super(mcpServer, PrintTextArgs.schema);
    }

    public getToolName(): string {
        return "print_text";
    }

    public getToolDescription(): string {
        return "Creates text in Penpot at the viewport center and selects it";
    }

    protected async executeCore(args: PrintTextArgs): Promise<ToolResponse> {
        const taskParams: PrintTextTaskParams = { text: args.text };
        const task = new PrintTextPluginTask(taskParams);
        await this.mcpServer.pluginBridge.executePluginTask(task);
        return new TextResponse(`Successfully created text "${args.text}" in Penpot.`);
    }
}
