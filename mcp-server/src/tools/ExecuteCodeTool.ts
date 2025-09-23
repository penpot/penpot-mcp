import { z } from "zod";
import { Tool } from "../Tool";
import type { ToolResponse } from "../ToolResponse";
import { TextResponse } from "../ToolResponse";
import "reflect-metadata";
import { PenpotMcpServer } from "../PenpotMcpServer";
import { ExecuteCodePluginTask } from "../tasks/ExecuteCodePluginTask";
import { ExecuteCodeTaskParams } from "@penpot-mcp/common";

/**
 * Arguments class for ExecuteCodeTool
 */
export class ExecuteCodeArgs {
    static schema = {
        code: z.string().min(1, "Code cannot be empty"),
    };

    /**
     * The JavaScript code to execute in the plugin context.
     */
    code!: string;
}

/**
 * Tool for executing JavaScript code in the Penpot plugin context
 */
export class ExecuteCodeTool extends Tool<ExecuteCodeArgs> {
    /**
     * Creates a new ExecuteCode tool instance.
     *
     * @param mcpServer - The MCP server instance
     */
    constructor(mcpServer: PenpotMcpServer) {
        super(mcpServer, ExecuteCodeArgs.schema);
    }

    public getToolName(): string {
        return "execute_code";
    }

    public getToolDescription(): string {
        return (
            "Executes JavaScript code in the Penpot plugin context. " +
            "Two objects are available: `penpot` (the Penpot API) and `storage` (an object in which arbitrary " +
            "data can be stored, simply by adding a new attribute; stored attributes can be referenced in future calls " +
            "to this tool, so any intermediate results that could come in handy later should be stored in `storage` " +
            "instead of just a fleeting variable).\n" +
            "The tool call returns the value of the concluding return statement, if any.\n" +
            "Note that using console.log() in your code makes no sense as you will not see the output.\n" +
            "In general, try a simple approach first, and only if it fails, try more complex code that involves " +
            "handling different cases (in particular error cases)."
        );
    }

    protected async executeCore(args: ExecuteCodeArgs): Promise<ToolResponse> {
        const taskParams: ExecuteCodeTaskParams = { code: args.code };
        const task = new ExecuteCodePluginTask(taskParams);
        const result = await this.mcpServer.pluginBridge.executePluginTask(task);

        if (result.data !== undefined) {
            return new TextResponse(`Code executed successfully. Result: ${JSON.stringify(result.data, null, 2)}`);
        } else {
            return new TextResponse("Code executed successfully with no return value.");
        }
    }
}
