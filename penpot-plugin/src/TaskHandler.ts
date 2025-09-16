
/**
 * Abstract base class for task handlers in the Penpot MCP plugin.
 *
 * @template TParams - The type of parameters this handler expects
 */
export abstract class TaskHandler<TParams = any> {
    /** The task identifier this handler is responsible for */
    abstract readonly task: string;

    /**
     * Checks if this handler can process the given task.
     *
     * @param task - The task identifier to check
     * @returns True if this handler applies to the given task
     */
    applies(task: string): boolean {
        return this.task === task;
    }

    /**
     * Sends a task response back to the MCP server.
     */
    public static sendTaskResponse(taskId: string, success: boolean, data: any = undefined, error: any = undefined): void {
        const response = {
            type: "task-response",
            response: {
                id: taskId,
                success: success,
                data: data,
                error: error,
            },
        };

        // Send to main.ts which will forward to MCP server via WebSocket
        penpot.ui.sendMessage(response);
        console.log("Sent task response:", response);
    }

    public static sendTaskSuccess(taskId: string, data: any = undefined): void {
        this.sendTaskResponse(taskId, true, data);
    }

    public static sendTaskError(taskId: string, error: string): void {
        this.sendTaskResponse(taskId, false, undefined, error);
    }

    /**
     * Handles the task with the provided parameters.
     *
     * @param taskId - The unique ID of the task request
     * @param params - The parameters for the task
     */
    abstract handle(taskId: string, params: TParams): void;
}