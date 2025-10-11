import { ExecuteCodeTaskHandler } from "./task-handlers/ExecuteCodeTaskHandler";
import { Task, TaskHandler } from "./TaskHandler";

/**
 * Registry of all available task handlers.
 */
const taskHandlers: TaskHandler[] = [new ExecuteCodeTaskHandler()];

penpot.ui.open("Penpot MCP Plugin", `?theme=${penpot.theme}`, { width: 158, height: 200 });

// Handle both legacy string messages and new request-based messages
penpot.ui.onMessage<string | { id: string; task: string; params: any }>((message) => {
    if (typeof message === "object" && message.task && message.id) {
        handlePluginTaskRequest(message).catch((error) => {
            console.error("Error in handlePluginTaskRequest:", error);
        });
    }
});

/**
 * Handles plugin task requests received from the MCP server via WebSocket.
 *
 * @param request - The task request containing ID, task type and parameters
 */
async function handlePluginTaskRequest(request: { id: string; task: string; params: any }): Promise<void> {
    console.log("Executing plugin task:", request.task, request.params);
    const task = new Task(request.id, request.task, request.params);

    // Find the appropriate handler
    const handler = taskHandlers.find((h) => h.isApplicableTo(task));

    if (handler) {
        try {
            // Cast the params to the expected type and handle the task
            console.log("Processing task with handler:", handler);
            await handler.handle(task);

            // check whether a response was sent and send a generic success if not
            if (!task.isResponseSent) {
                console.warn("Handler did not send a response, sending generic success.");
                task.sendSuccess("Task completed without a specific response.");
            }

            console.log("Task handled successfully:", task);
        } catch (error) {
            console.error("Error handling task:", error);
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            task.sendError(`Error handling task: ${errorMessage}`);
        }
    } else {
        console.error("Unknown plugin task:", request.task);
        task.sendError(`Unknown task type: ${request.task}`);
    }
}

// Update the theme in the iframe
penpot.on("themechange", (theme) => {
    penpot.ui.sendMessage({
        source: "penpot",
        type: "themechange",
        theme,
    });
});
