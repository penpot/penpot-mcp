import { z } from "zod";
import { Tool } from "../Tool";
import { PNGImageContent, PNGResponse, TextResponse, ToolResponse } from "../ToolResponse";
import "reflect-metadata";
import { PenpotMcpServer } from "../PenpotMcpServer";
import { ExecuteCodePluginTask } from "../tasks/ExecuteCodePluginTask";
import { FileUtils } from "../utils/FileUtils";

/**
 * Arguments class for ExecuteCodeTool
 */
export class ExportShapeArgs {
    static schema = {
        shapeId: z
            .string()
            .min(1, "shapeId cannot be empty")
            .describe(
                "Identifier of the shape to export. Use the special identifier 'selection' to " +
                    "export the first shape currently selected by the user."
            ),
        format: z.enum(["svg", "png"]).default("png").describe("The output format, either PNG (default) or SVG."),
        filePath: z
            .string()
            .optional()
            .describe(
                "Optional file path to save the exported image to. If not provided, " +
                    "the image data is returned directly for you to see."
            ),
    };

    shapeId!: string;

    format: "svg" | "png" = "png";

    filePath?: string;
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
        return "export_shape";
    }

    public getToolDescription(): string {
        return (
            "Exports a shape from the Penpot design to a PNG or SVG image, " +
            "such that you can get an impression of what the shape looks like.\n" +
            "Alternatively, you can save it to a file."
        );
    }

    protected async executeCore(args: ExportShapeArgs): Promise<ToolResponse> {
        // check arguments
        if (args.filePath) {
            FileUtils.checkPathIsAbsolute(args.filePath);
        }

        // create code for exporting the shape
        let shapeCode: string;
        if (args.shapeId === "selection") {
            shapeCode = `penpot.selection[0]`;
        } else {
            shapeCode = `penpotUtils.findShapeById("${args.shapeId}")`;
        }
        const code = `return ${shapeCode}.export({"type": "${args.format}"});`;

        // execute the code and obtain the image data
        const task = new ExecuteCodePluginTask({ code: code });
        const result = await this.mcpServer.pluginBridge.executePluginTask(task);
        const imageData = result.data!.result;

        // handle output and return response
        if (!args.filePath) {
            // return image data directly (for the LLM to "see" it)
            if (args.format === "png") {
                return new PNGResponse(imageData);
            } else {
                return new TextResponse(imageData);
            }
        } else {
            // save image to file
            if (args.format === "png") {
                FileUtils.writeBinaryFile(args.filePath, PNGImageContent.byteData(imageData));
            } else {
                FileUtils.writeTextFile(args.filePath, imageData);
            }
            return new TextResponse(`The shape has been exported to ${args.filePath}`);
        }
    }
}
