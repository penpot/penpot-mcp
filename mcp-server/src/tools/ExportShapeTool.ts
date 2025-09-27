import { z } from "zod";
import { Tool } from "../Tool";
import { PNGResponse, ToolResponse } from "../ToolResponse";
import "reflect-metadata";
import { PenpotMcpServer } from "../PenpotMcpServer";
import { ExecuteCodePluginTask } from "../tasks/ExecuteCodePluginTask";
import { ExecuteCodeTaskParams } from "@penpot-mcp/common";

/**
 * Arguments class for ExecuteCodeTool
 */
export class ExportShapeArgs {
    static schema = {
        shapeId: z.string().min(1, "shapeId cannot be empty"),
    };

    /**
     * Identifier of the shape to export.
     * The special identifier "selection" can be used to refer to the (first) currently selected shape.
     */
    shapeId!: string;
}

/**
 * Tool for executing JavaScript code in the Penpot plugin context
 */
export class ExportShapeTool extends Tool<ExportShapeArgs> {
    /**
     * Creates a new ExecuteCode tool instance.
     *
     * @param mcpServer - The MCP server instance
     */
    constructor(mcpServer: PenpotMcpServer) {
        super(mcpServer, ExportShapeArgs.schema);
    }

    public getToolName(): string {
        return "export_shapes";
    }

    public getToolDescription(): string {
        return (
            "Exports a shape from the Penpot design to a PNG image, such that you can get an impression of what the shape looks like.\n" +
            "Parameter `shapeId`: identifier of the shapes to export. Use the special identifier 'selection' to " +
            "export the first shape currently selected by the user."
        );
    }

    protected async executeCore(args: ExportShapeArgs): Promise<ToolResponse> {
        // create code for exporting the shape
        let taskParams: ExecuteCodeTaskParams;
        if (args.shapeId === "selection") {
            taskParams = { code: 'return penpot.selection[0].export({"type": "png"});' };
        } else {
            throw new Error("Identifiers other than 'selection' are not yet supported");
        }

        // execute the code and return the response
        const task = new ExecuteCodePluginTask(taskParams);
        const result = await this.mcpServer.pluginBridge.executePluginTask(task);
        return new PNGResponse(result.data!.result);
    }
}
