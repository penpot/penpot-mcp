import { Task, TaskHandler } from "../TaskHandler";
import { ExecuteCodeTaskParams, ExecuteCodeTaskResultData } from "../../../common/src";
import { PenpotUtils } from "../PenpotUtils.ts";
import { nextRequestId, registerPending, LatexGlyph, LatexRenderResponse } from "../LatexBridge";

const LATEX_TIMEOUT_MS = 30_000;

/**
 * Console implementation that captures all log output for code execution.
 *
 * Provides the same interface as the native console object but appends
 * all output to an internal log string that can be retrieved.
 */
class ExecuteCodeTaskConsole {
    /**
     * Accumulated log output from all console method calls.
     */
    private logOutput: string = "";

    /**
     * Resets the accumulated log output to empty string.
     * Should be called before each code execution to start with clean logs.
     */
    resetLog(): void {
        this.logOutput = "";
    }

    /**
     * Gets the accumulated log output from all console method calls.
     * @returns The complete log output as a string
     */
    getLog(): string {
        return this.logOutput;
    }

    /**
     * Appends a formatted message to the log output.
     * @param level - Log level prefix (e.g., "LOG", "WARN", "ERROR")
     * @param args - Arguments to log, will be stringified and joined
     */
    private appendToLog(level: string, ...args: any[]): void {
        const message = args
            .map((arg) => (typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)))
            .join(" ");
        this.logOutput += `[${level}] ${message}\n`;
    }

    /**
     * Logs a message to the captured output.
     */
    log(...args: any[]): void {
        this.appendToLog("LOG", ...args);
    }

    /**
     * Logs a warning message to the captured output.
     */
    warn(...args: any[]): void {
        this.appendToLog("WARN", ...args);
    }

    /**
     * Logs an error message to the captured output.
     */
    error(...args: any[]): void {
        this.appendToLog("ERROR", ...args);
    }

    /**
     * Logs an informational message to the captured output.
     */
    info(...args: any[]): void {
        this.appendToLog("INFO", ...args);
    }

    /**
     * Logs a debug message to the captured output.
     */
    debug(...args: any[]): void {
        this.appendToLog("DEBUG", ...args);
    }

    /**
     * Logs a message with trace information to the captured output.
     */
    trace(...args: any[]): void {
        this.appendToLog("TRACE", ...args);
    }

    /**
     * Logs a table to the captured output (simplified as JSON).
     */
    table(data: any): void {
        this.appendToLog("TABLE", data);
    }

    /**
     * Starts a timer (simplified implementation that just logs).
     */
    time(label?: string): void {
        this.appendToLog("TIME", `Timer started: ${label || "default"}`);
    }

    /**
     * Ends a timer (simplified implementation that just logs).
     */
    timeEnd(label?: string): void {
        this.appendToLog("TIME_END", `Timer ended: ${label || "default"}`);
    }

    /**
     * Logs messages in a group (simplified to just log the label).
     */
    group(label?: string): void {
        this.appendToLog("GROUP", label || "");
    }

    /**
     * Logs messages in a collapsed group (simplified to just log the label).
     */
    groupCollapsed(label?: string): void {
        this.appendToLog("GROUP_COLLAPSED", label || "");
    }

    /**
     * Ends the current group (simplified implementation).
     */
    groupEnd(): void {
        this.appendToLog("GROUP_END", "");
    }

    /**
     * Clears the console (no-op in this implementation since we want to capture logs).
     */
    clear(): void {
        // intentionally empty - we don't want to clear captured logs
    }

    /**
     * Counts occurrences of calls with the same label (simplified implementation).
     */
    count(label?: string): void {
        this.appendToLog("COUNT", label || "default");
    }

    /**
     * Resets the count for a label (simplified implementation).
     */
    countReset(label?: string): void {
        this.appendToLog("COUNT_RESET", label || "default");
    }

    /**
     * Logs an assertion (simplified to just log if condition is false).
     */
    assert(condition: boolean, ...args: any[]): void {
        if (!condition) {
            this.appendToLog("ASSERT", ...args);
        }
    }
}

/**
 * Task handler for executing JavaScript code in the plugin context.
 *
 * Maintains a persistent context object that preserves state between code executions
 * and captures all console output during execution.
 */
export class ExecuteCodeTaskHandler extends TaskHandler<ExecuteCodeTaskParams> {
    readonly taskType = "executeCode";

    /**
     * Persistent context object that maintains state between code executions.
     * Contains the penpot API, storage object, and custom console implementation.
     */
    private readonly context: any;

    constructor() {
        super();

        // initialize context, making penpot, penpotUtils, storage, console, and latex helper available
        //
        // The plugin sandbox has no DOM; latex rendering is routed to the UI iframe
        // (see LatexBridge + main.ts handleLatexRender). The helper is async — callers
        // must `await latex(...)`.
        const latex = async (tex: string, opts: any = {}): Promise<any[]> => {
            const fontSize: number = typeof opts.fontSize === "number" ? opts.fontSize : 16;
            const xBase: number = typeof opts.x === "number" ? opts.x : 0;
            const yBase: number = typeof opts.y === "number" ? opts.y : 0;
            const inkColor: string = opts.color || "#1f2229";
            const parent = opts.parent || null;
            const display: boolean = opts.display !== false;

            const requestId = nextRequestId();
            const resp: LatexRenderResponse = await new Promise((resolve, reject) => {
                const timer = setTimeout(() => {
                    reject(new Error(`latex render timed out after ${LATEX_TIMEOUT_MS}ms`));
                }, LATEX_TIMEOUT_MS);
                registerPending(requestId, (r) => {
                    clearTimeout(timer);
                    resolve(r);
                });
                penpot.ui.sendMessage({
                    type: "latex-render",
                    requestId,
                    tex,
                    opts: { fontSize, display },
                });
            });

            if (resp.error) {
                throw new Error(resp.error);
            }

            const glyphs: LatexGlyph[] = resp.glyphs ?? [];
            const created: any[] = [];
            // t.x / t.y are page absolute coordinates. If a board parent is given,
            // its (page x, page y) must be added so glyphs land *inside* the board.
            const xOff = (parent && parent.type === "board") ? parent.x : 0;
            const yOff = (parent && parent.type === "board") ? parent.y : 0;
            // Korean glyphs need a Hangul font; math/Greek/Latin need a math-capable font.
            // STIX Two Text covers Greek + math operators (Σ α ∫ → …). Hangul falls back
            // to Noto Sans KR. Detected per-glyph.
            const hangul = /[ᄀ-ᇿ㄰-㆏가-힯]/;
            for (const g of glyphs) {
                const t = (penpot as any).createText(g.text);
                if (!t) continue;
                t.growType = "auto-width";
                if (hangul.test(g.text)) {
                    t.fontId = "gfont-noto-sans-kr";
                    t.fontFamily = "Noto Sans KR";
                } else {
                    t.fontId = "gfont-stix-two-text";
                    t.fontFamily = "STIX Two Text";
                }
                t.fontVariantId = "regular";
                t.fontWeight = "400";
                t.fontSize = String(Math.round(g.fontSize));
                t.fills = [{ fillColor: inkColor, fillOpacity: 1 }];
                t.x = xOff + xBase + g.x;
                t.y = yOff + yBase + g.y;
                if (parent && typeof parent.appendChild === "function") {
                    parent.appendChild(t);
                }
                created.push(t);
            }
            return created;
        };

        this.context = {
            penpot: penpot,
            storage: {},
            console: new ExecuteCodeTaskConsole(),
            penpotUtils: PenpotUtils,
            latex,
        };
    }

    async handle(task: Task<ExecuteCodeTaskParams>): Promise<void> {
        if (!task.params.code) {
            task.sendError("executeCode task requires 'code' parameter");
            return;
        }

        this.context.console.resetLog();

        const context = this.context;
        const code = task.params.code;

        let result: any = await (async (ctx) => {
            const fn = new Function(...Object.keys(ctx), `return (async () => { ${code} })();`);
            return fn(...Object.values(ctx));
        })(context);

        console.log("Code execution result:", result);

        // return result and captured log
        let resultData: ExecuteCodeTaskResultData<any> = {
            result: result,
            log: this.context.console.getLog(),
        };
        task.sendSuccess(resultData);
    }
}
