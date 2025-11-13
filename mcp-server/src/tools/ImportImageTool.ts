import { z } from "zod";
import { Tool } from "../Tool";
import { TextResponse, ToolResponse } from "../ToolResponse";
import "reflect-metadata";
import { PenpotMcpServer } from "../PenpotMcpServer";
import { ExecuteCodePluginTask } from "../tasks/ExecuteCodePluginTask";
import { FileUtils } from "../utils/FileUtils";
import * as fs from "fs";
import * as path from "path";

/**
 * Arguments class for ImportImageTool
 */
export class ImportImageArgs {
    static schema = {
        filePath: z.string().min(1, "filePath cannot be empty").describe("Absolute path to the image file to import."),
        x: z.number().optional().describe("Optional X coordinate for the rectangle's position."),
        y: z.number().optional().describe("Optional Y coordinate for the rectangle's position."),
        width: z
            .number()
            .positive("width must be positive")
            .optional()
            .describe(
                "Optional width for the rectangle. If only width is provided, height is calculated to maintain aspect ratio."
            ),
        height: z
            .number()
            .positive("height must be positive")
            .optional()
            .describe(
                "Optional height for the rectangle. If only height is provided, width is calculated to maintain aspect ratio."
            ),
    };

    filePath!: string;

    x?: number;

    y?: number;

    width?: number;

    height?: number;
}

/**
 * Tool for importing an image from the local file system into Penpot
 */
export class ImportImageTool extends Tool<ImportImageArgs> {
    /**
     * Maps file extensions to MIME types.
     */
    protected static readonly MIME_TYPES: { [key: string]: string } = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".bmp": "image/bmp",
    };

    /**
     * Creates a new ImportImage tool instance.
     *
     * @param mcpServer - The MCP server instance
     */
    constructor(mcpServer: PenpotMcpServer) {
        super(mcpServer, ImportImageArgs.schema);
    }

    public getToolName(): string {
        return "import_image";
    }

    public getToolDescription(): string {
        return (
            "Imports a pixel image from the local file system into Penpot by creating a Rectangle instance " +
            "that uses the image as a fill. The rectangle has the image's original proportions by default. " +
            "Optionally accepts position (x, y) and dimensions (width, height) parameters. " +
            "If only one dimension is provided, the other is calculated to maintain the image's aspect ratio. " +
            "Supported image formats: JPG, PNG, GIF, WEBP, and BMP."
        );
    }

    protected async executeCore(args: ImportImageArgs): Promise<ToolResponse> {
        // check that file path is absolute
        FileUtils.checkPathIsAbsolute(args.filePath);

        // check that file exists
        if (!fs.existsSync(args.filePath)) {
            throw new Error(`File not found: ${args.filePath}`);
        }

        // read the file as binary data
        const fileData = fs.readFileSync(args.filePath);
        const base64Data = fileData.toString("base64");

        // determine mime type from file extension
        const ext = path.extname(args.filePath).toLowerCase();
        const mimeType = ImportImageTool.MIME_TYPES[ext];
        if (!mimeType) {
            const supportedExtensions = Object.keys(ImportImageTool.MIME_TYPES).join(", ");
            throw new Error(
                `Unsupported image format: ${ext}. Supported formats (file extensions): ${supportedExtensions}`
            );
        }

        // generate and execute JavaScript code to import the image
        const fileName = path.basename(args.filePath);
        const code = this.generateImportCode(fileName, base64Data, mimeType, args);
        const task = new ExecuteCodePluginTask({ code: code });
        await this.mcpServer.pluginBridge.executePluginTask(task);

        return new TextResponse(`Image imported successfully from ${args.filePath}`);
    }

    /**
     * Generates the JavaScript code to import the image in the Penpot plugin context.
     *
     * @param fileName - The name of the file
     * @param base64Data - The base64-encoded image data
     * @param mimeType - The MIME type of the image
     * @param args - The tool arguments containing position and dimension parameters
     */
    protected generateImportCode(
        fileName: string,
        base64Data: string,
        mimeType: string,
        args: ImportImageArgs
    ): string {
        // escape the base64 data for use in a JavaScript string
        const escapedBase64 = base64Data.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
        const escapedFileName = fileName.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

        return `
            // convert base64 to Uint8Array
            const base64 = '${escapedBase64}';
            const bytes = penpotUtils.atob(base64);
        
            // upload the image data to Penpot
            const imageData = await penpot.uploadMediaData('${escapedFileName}', bytes, '${mimeType}');
        
            // create a rectangle shape
            const rect = penpot.createRectangle();
            rect.name = '${escapedFileName}';
        
            // calculate dimensions
            let rectWidth, rectHeight;
            const hasWidth = ${args.width !== undefined};
            const hasHeight = ${args.height !== undefined};
        
            if (hasWidth && hasHeight) {
                // both width and height provided - use them directly
                rectWidth = ${args.width ?? 0};
                rectHeight = ${args.height ?? 0};
            } else if (hasWidth) {
                // only width provided - maintain aspect ratio
                rectWidth = ${args.width ?? 0};
                rectHeight = rectWidth * (imageData.height / imageData.width);
            } else if (hasHeight) {
                // only height provided - maintain aspect ratio
                rectHeight = ${args.height ?? 0};
                rectWidth = rectHeight * (imageData.width / imageData.height);
            } else {
                // neither provided - use original dimensions
                rectWidth = imageData.width;
                rectHeight = imageData.height;
            }
        
            // set rectangle dimensions
            rect.resize(rectWidth, rectHeight);
        
            // set position if provided
            ${args.x !== undefined ? `rect.x = ${args.x};` : ""}
            ${args.y !== undefined ? `rect.y = ${args.y};` : ""}
        
            // apply the image as a fill
            rect.fills = [{ fillOpacity: 1, fillImage: imageData }];
        
            return { shapeId: rect.id };`;
    }
}
