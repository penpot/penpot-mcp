/**
 * Base class for plugin tasks that are sent over WebSocket.
 *
 * Each task defines a specific operation for the plugin to execute
 * along with strongly-typed parameters.
 *
 * @template TParams - The strongly-typed parameters for this task
 */
export abstract class PluginTask<TParams = any, TResult = any> {
    /**
     * The name of the task to execute on the plugin side.
     */
    public readonly task: string;

    /**
     * The parameters for this task execution.
     */
    public readonly params: TParams;

    private result?: Promise<TResult> = undefined;

    /**
     * Creates a new plugin task instance.
     *
     * @param task - The name of the task to execute
     * @param params - The parameters for task execution
     */
    constructor(task: string, params: TParams) {
        this.task = task;
        this.params = params;
    }

    /**
     * Sets the result promise for this task.
     *
     * This can be used to track the outcome of the task execution.
     *
     * @param resultPromise - A promise that resolves to the task result
     */
    setResult(resultPromise: Promise<TResult>): void {
        this.result = resultPromise;
    }

    /**
     * Serializes the task to JSON for WebSocket transmission.
     */
    toJSON(): { task: string; params: TParams } {
        return {
            task: this.task,
            params: this.params,
        };
    }
}

/**
 * Parameters for the printText task.
 */
export class PluginTaskPrintTextParams {
    /**
     * The text to be displayed in Penpot.
     */
    public readonly text: string;

    constructor(text: string) {
        this.text = text;
    }
}

/**
 * Task for printing/creating text in Penpot.
 *
 * This task instructs the plugin to create a text element
 * at the viewport center and select it.
 */
export class PluginTaskPrintText extends PluginTask<PluginTaskPrintTextParams> {
    /**
     * Creates a new print text task.
     *
     * @param params - The parameters containing the text to print
     */
    constructor(params: PluginTaskPrintTextParams) {
        super("printText", params);
    }
}
