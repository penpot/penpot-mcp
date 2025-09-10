penpot.ui.open("Penpot MCP Plugin", `?theme=${penpot.theme}`);

// Handle both legacy string messages and new task-based messages
penpot.ui.onMessage<string | { task: string; params: any }>((message) => {
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

  // New task-based message handling
  if (typeof message === "object" && message.task) {
    handlePluginTask(message);
  }
});

/**
 * Handles plugin tasks received from the MCP server via WebSocket.
 * 
 * @param taskMessage - The task message containing task type and parameters
 */
function handlePluginTask(taskMessage: { task: string; params: any }): void {
  console.log("Executing plugin task:", taskMessage.task, taskMessage.params);

  switch (taskMessage.task) {
    case "printText":
      handlePrintTextTask(taskMessage.params);
      break;
    
    default:
      console.warn("Unknown plugin task:", taskMessage.task);
  }
}

/**
 * Handles the printText task by creating text in Penpot.
 * 
 * @param params - The parameters containing the text to create
 */
function handlePrintTextTask(params: { text: string }): void {
  if (!params.text) {
    console.error("printText task requires 'text' parameter");
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
    } else {
      console.error("Failed to create text element");
    }
  } catch (error) {
    console.error("Error creating text:", error);
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
