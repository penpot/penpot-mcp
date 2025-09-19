import {PrintTextTaskHandler} from "./task-handlers/PrintTextTaskHandler";
import {ExecuteCodeTaskHandler} from "./task-handlers/ExecuteCodeTaskHandler";
import {Task, TaskHandler} from "./TaskHandler";

/**
 * Registry of all available task handlers.
 */
const taskHandlers: TaskHandler[] = [
    new PrintTextTaskHandler(),
    new ExecuteCodeTaskHandler(),
];

penpot.ui.open("Penpot MCP Plugin", `?theme=${penpot.theme}`);

// Handle both legacy string messages and new request-based messages
penpot.ui.onMessage<string | { id: string; task: string; params: any }>((message) => {
    // Legacy string-based message handling
    if (typeof message === "string") {
        if (message === "create-text") {
            const text = penpot.createText("Hello world!");

            if (text) {
                text.x = penpot.viewport.center.x;
                text.y = penpot.viewport.center.y;

                penpot.selection = [text];
            }
        }
        return;
    }

    // New request-based message handling
    if (typeof message === "object" && message.task && message.id) {
        handlePluginTaskRequest(message);
    }
});

/**
 * Handles plugin task requests received from the MCP server via WebSocket.
 *
 * @param request - The task request containing ID, task type and parameters
 */
function handlePluginTaskRequest(request: { id: string; task: string; params: any }): void {
    console.log("Executing plugin task:", request.task, request.params);
    const task = new Task(request.id, request.task, request.params);

    // Find the appropriate handler
    const handler = taskHandlers.find(h => h.isApplicableTo(task));

    if (handler) {
        try {
            // Cast the params to the expected type and handle the task
            console.log("Processing task with handler:", handler);
            handler.handle(task);
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
