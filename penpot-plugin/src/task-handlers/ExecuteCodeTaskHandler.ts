import { Task, TaskHandler } from "../TaskHandler";
import { ExecuteCodeTaskParams, ExecuteCodeTaskResultData } from "../../../common/src";
import { PenpotUtils } from "../PenpotUtils.ts";

const MAX_RESULT_NODES = 5000;
const MAX_RESULT_DEPTH = 8;
const MAX_ARRAY_ITEMS = 200;
const MAX_OBJECT_KEYS = 200;
const MAX_LOG_CHARS = 20000;

function truncateString(value: string, maxChars: number): string {
    if (value.length <= maxChars) {
        return value;
    }
    return `${value.slice(0, maxChars)}\n...[truncated ${value.length - maxChars} chars]`;
}

function sanitizeForTransport(value: any): any {
    const visited = new WeakSet<object>();
    const state = { remainingNodes: MAX_RESULT_NODES };

    const walk = (current: any, depth: number): any => {
        if (state.remainingNodes <= 0) {
            return "[Truncated: node limit reached]";
        }

        if (current === null || current === undefined) {
            return current;
        }

        const currentType = typeof current;
        if (currentType === "string" || currentType === "number" || currentType === "boolean") {
            return current;
        }

        if (currentType === "bigint") {
            return `${current.toString()}n`;
        }

        if (currentType === "function") {
            return `[Function: ${current.name || "anonymous"}]`;
        }

        if (current instanceof Date) {
            return current.toISOString();
        }

        if (depth >= MAX_RESULT_DEPTH) {
            return `[Truncated: max depth ${MAX_RESULT_DEPTH} reached]`;
        }

        if (typeof current === "object") {
            if (visited.has(current)) {
                return "[Circular]";
            }
            visited.add(current);
            state.remainingNodes -= 1;

            if (Array.isArray(current)) {
                const limited = current.slice(0, MAX_ARRAY_ITEMS).map((item) => walk(item, depth + 1));
                if (current.length > MAX_ARRAY_ITEMS) {
                    limited.push(`[Truncated: ${current.length - MAX_ARRAY_ITEMS} more items]`);
                }
                return limited;
            }

            const entries = Object.entries(current);
            const limitedEntries = entries.slice(0, MAX_OBJECT_KEYS);
            const output: Record<string, any> = {};

            for (const [key, val] of limitedEntries) {
                output[key] = walk(val, depth + 1);
            }

            if (entries.length > MAX_OBJECT_KEYS) {
                output.__truncated__ = `${entries.length - MAX_OBJECT_KEYS} more keys`;
            }

            return output;
        }

        return String(current);
    };

    return walk(value, 0);
}

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

        // initialize context, making penpot, penpotUtils, storage and the custom console available
        this.context = {
            penpot: penpot,
            storage: {},
            console: new ExecuteCodeTaskConsole(),
            penpotUtils: PenpotUtils,
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

        // return result and captured log
        let resultData: ExecuteCodeTaskResultData<any> = {
            result: sanitizeForTransport(result),
            log: truncateString(this.context.console.getLog(), MAX_LOG_CHARS),
        };
        task.sendSuccess(resultData);
    }
}
