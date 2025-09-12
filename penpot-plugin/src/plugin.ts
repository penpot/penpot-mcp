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

    switch (request.task) {
        case "printText":
            handlePrintTextTask(request.id, request.params);
            break;

        default:
            console.warn("Unknown plugin task:", request.task);
            sendTaskResponse(request.id, {
                success: false,
                error: `Unknown task type: ${request.task}`,
            });
    }
}

/**
 * Handles the printText task by creating text in Penpot.
 *
 * @param taskId - The unique ID of the task request
 * @param params - The parameters containing the text to create
 */
function handlePrintTextTask(taskId: string, params: { text: string }): void {
    if (!params.text) {
        console.error("printText task requires 'text' parameter");
        sendTaskResponse(taskId, {
            success: false,
            error: "printText task requires 'text' parameter",
        });
        return;
    }

    try {
        const text = penpot.createText(params.text);

        if (text) {
            // Center the text in the viewport
            text.x = penpot.viewport.center.x;
            text.y = penpot.viewport.center.y;

            // Select the newly created text
            penpot.selection = [text];

            console.log("Successfully created text:", params.text);
            sendTaskResponse(taskId, {
                success: true,
                data: { textId: text.id },
            });
        } else {
            console.error("Failed to create text element");
            sendTaskResponse(taskId, {
                success: false,
                error: "Failed to create text element",
            });
        }
    } catch (error) {
        console.error("Error creating text:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        sendTaskResponse(taskId, {
            success: false,
            error: `Error creating text: ${errorMessage}`,
        });
    }
}

/**
 * Sends a task response back to the MCP server.
 *
 * @param taskId - The unique ID of the original task request
 * @param result - The task execution result
 */
function sendTaskResponse(taskId: string, result: { success: boolean; error?: string; data?: any }): void {
    const response = {
        type: "task-response",
        response: {
            id: taskId,
            result: result,
        },
    };

    // Send to main.ts which will forward to MCP server via WebSocket
    penpot.ui.sendMessage(response);
    console.log("Sent task response:", response);
}

// Update the theme in the iframe
penpot.on("themechange", (theme) => {
    penpot.ui.sendMessage({
        source: "penpot",
        type: "themechange",
        theme,
    });
});
