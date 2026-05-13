import { z } from "zod";
import { Tool } from "../Tool";
import type { ToolResponse } from "../ToolResponse";
import { TextResponse } from "../ToolResponse";
import "reflect-metadata";
import { PenpotMcpServer } from "../PenpotMcpServer";
import { ExecuteCodePluginTask } from "../tasks/ExecuteCodePluginTask";
import { ExecuteCodeTaskParams } from "@penpot-mcp/common";

/**
 * Arguments for the render_latex tool.
 */
export class RenderLatexArgs {
    static schema = {
        tex: z
            .string()
            .min(1, "tex cannot be empty")
            .describe(
                "LaTeX expression to render (e.g. '\\\\lim_{x \\\\to a} f(x) = L'). " +
                    "Use '\\\\text{한글}' to mix Hangul with math; Hangul glyphs auto-fall-back " +
                    "to Noto Sans KR, math/Greek glyphs use STIX Two Text."
            ),
        x: z
            .number()
            .default(0)
            .describe("x offset inside the parent board (px). Default 0."),
        y: z
            .number()
            .default(0)
            .describe("y offset inside the parent board (px). Default 0."),
        fontSize: z
            .number()
            .default(22)
            .describe("Base font size in px. Default 22."),
        color: z
            .string()
            .default("#1f2229")
            .describe("Ink color (hex). Default #1f2229."),
        display: z
            .boolean()
            .default(true)
            .describe("KaTeX display mode (true=block, false=inline). Default true."),
        parentId: z
            .string()
            .optional()
            .describe(
                "ID of the parent board. If omitted, the first board on the current page is used. " +
                    "Pass the special string 'selection' to use the currently selected board."
            ),
    };

    tex!: string;
    x: number = 0;
    y: number = 0;
    fontSize: number = 22;
    color: string = "#1f2229";
    display: boolean = true;
    parentId?: string;
}

/**
 * Renders a LaTeX expression as a group of Penpot text nodes inside a board.
 *
 * Internally delegates to the plugin-side `latex(tex, opts)` helper installed
 * by `ExecuteCodeTaskHandler`. The helper routes rendering to the UI iframe
 * (KaTeX HTML + per-glyph layout measurement) and creates one text node per
 * glyph in the plugin sandbox.
 */
export class RenderLatexTool extends Tool<RenderLatexArgs> {
    constructor(mcpServer: PenpotMcpServer) {
        super(mcpServer, RenderLatexArgs.schema);
    }

    public getToolName(): string {
        return "render_latex";
    }

    public getToolDescription(): string {
        return (
            "Renders a LaTeX expression as a group of Penpot text nodes inside a board.\n" +
            "Each glyph (lim, x, →, a, f, (, x, ), =, L, etc.) becomes a separate text node " +
            "positioned by KaTeX layout. Math/Greek/operators use STIX Two Text; Hangul uses " +
            "Noto Sans KR (auto-detected per glyph).\n" +
            "Use this for: equation boxes in study material, inline math captions, formula labels.\n" +
            "Returns the IDs and count of created glyph text nodes.\n" +
            "If parentId is omitted, the first board on the current page is used."
        );
    }

    protected async executeCore(args: RenderLatexArgs): Promise<ToolResponse> {
        const parentLookup = args.parentId
            ? args.parentId === "selection"
                ? "penpot.selection.find(s=>s.type==='board')||penpot.currentPage.root.children.find(c=>c.type==='board')"
                : `penpot.currentPage.root.children.find(c=>c.id===${JSON.stringify(args.parentId)})`
            : "penpot.currentPage.root.children.find(c=>c.type==='board')";

        const code = `
            const parent = ${parentLookup};
            if (!parent) { return { error: "No suitable parent board found" }; }
            const eqs = await latex(${JSON.stringify(args.tex)}, {
                x: ${args.x},
                y: ${args.y},
                fontSize: ${args.fontSize},
                color: ${JSON.stringify(args.color)},
                display: ${args.display},
                parent,
            });
            return {
                count: eqs.length,
                parentId: parent.id,
                parentName: parent.name,
                ids: eqs.map(t => t.id),
            };
        `;

        const task = new ExecuteCodePluginTask({ code } as ExecuteCodeTaskParams);
        const result = await this.mcpServer.pluginBridge.executePluginTask(task);
        if (result.data !== undefined) {
            return new TextResponse(JSON.stringify(result.data, null, 2));
        }
        return new TextResponse("render_latex executed with no return value.");
    }
}
