import { z } from "zod";
import { Tool } from "../Tool";
import type { ToolResponse } from "../ToolResponse";
import { TextResponse } from "../ToolResponse";
import "reflect-metadata";
import { PenpotMcpServer } from "../PenpotMcpServer";
import { ExecuteCodePluginTask } from "../tasks/ExecuteCodePluginTask";

/**
 * Arguments class for CreateFrameTool
 */
export class CreateFrameArgs {
    static schema = {
        name: z
            .string()
            .optional()
            .describe("Name for the frame. Defaults to 'Frame' if not provided."),
        x: z
            .number()
            .optional()
            .describe("X position of the frame on the canvas. Defaults to 0."),
        y: z
            .number()
            .optional()
            .describe("Y position of the frame on the canvas. Defaults to 0."),
        width: z
            .number()
            .optional()
            .describe("Width of the frame in pixels. Defaults to 100."),
        height: z
            .number()
            .optional()
            .describe("Height of the frame in pixels. Defaults to 100."),
    };

    name?: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
}

/**
 * Tool for creating a frame (board) in Penpot.
 *
 * Note: The Penpot Plugin API uses `penpot.createBoard()` to create frames.
 * The term "board" is Penpot's internal name for what is displayed as a "frame"
 * in the UI and referred to as a frame in design tool conventions.
 * This tool provides a `create_frame` name to match that convention and
 * reduce confusion when coming from other design tools.
 *
 * See: https://github.com/penpot/penpot-mcp/issues/43
 */
export class CreateFrameTool extends Tool<CreateFrameArgs> {
    constructor(mcpServer: PenpotMcpServer) {
        super(mcpServer, CreateFrameArgs.schema);
    }

    public getToolName(): string {
        return "create_frame";
    }

    public getToolDescription(): string {
        return (
            "Creates a frame on the current Penpot page.\n" +
            "Frames are the primary container element in Penpot (equivalent to frames in Figma " +
            "or artboards in other design tools).\n" +
            "Note: The Penpot Plugin API exposes frames as 'boards' (`penpot.createBoard()`). " +
            "This tool wraps that API under the conventional 'frame' name.\n" +
            "Returns the ID and properties of the created frame."
        );
    }

    protected async executeCore(args: CreateFrameArgs): Promise<ToolResponse> {
        const name = args.name ?? "Frame";
        const x = args.x ?? 0;
        const y = args.y ?? 0;
        const width = args.width ?? 100;
        const height = args.height ?? 100;

        const code = `
const frame = penpot.createBoard();
frame.name = ${JSON.stringify(name)};
frame.x = ${x};
frame.y = ${y};
frame.width = ${width};
frame.height = ${height};
penpot.currentPage.appendChild(frame);
return { id: frame.id, name: frame.name, x: frame.x, y: frame.y, width: frame.width, height: frame.height };
        `.trim();

        const task = new ExecuteCodePluginTask({ code });
        const result = await this.mcpServer.pluginBridge.executePluginTask(task);

        if (result.data !== undefined) {
            return new TextResponse(JSON.stringify(result.data, null, 2));
        } else {
            return new TextResponse("Frame created successfully.");
        }
    }
}
