import "./style.css";

// get the current theme from the URL
const searchParams = new URLSearchParams(window.location.search);
document.body.dataset.theme = searchParams.get("theme") ?? "light";

// WebSocket connection management
let ws: WebSocket | null = null;
const statusElement = document.getElementById("connection-status");

/**
 * Updates the connection status display element.
 */
function updateConnectionStatus(status: string, isConnectedState: boolean): void {
    if (statusElement) {
        statusElement.textContent = status;
        statusElement.style.color = isConnectedState ? "#4CAF50" : "#666";
    }
}

/**
 * Establishes a WebSocket connection to the MCP server.
 */
function connectToMcpServer(): void {
    if (ws?.readyState === WebSocket.OPEN) {
        updateConnectionStatus("Already connected", true);
        return;
    }

    try {
        ws = new WebSocket("ws://localhost:8080");
        updateConnectionStatus("Connecting...", false);

        ws.onopen = () => {
            console.log("Connected to MCP server");
            updateConnectionStatus("Connected to MCP server", true);
        };

        ws.onmessage = (event) => {
            console.log("Received from MCP server:", event.data);
            try {
                const message = JSON.parse(event.data);
                // Forward the task to the plugin for execution
                parent.postMessage(message, "*");
            } catch (error) {
                console.error("Failed to parse WebSocket message:", error);
            }
        };

        ws.onclose = () => {
            console.log("Disconnected from MCP server");
            updateConnectionStatus("Disconnected", false);
            ws = null;
        };

        ws.onerror = (error) => {
            console.error("WebSocket error:", error);
            updateConnectionStatus("Connection error", false);
        };
    } catch (error) {
        console.error("Failed to connect to MCP server:", error);
        updateConnectionStatus("Connection failed", false);
    }
}

// Event handlers
document.querySelector("[data-handler='create-text']")?.addEventListener("click", () => {
    // send message to plugin.ts
    parent.postMessage("create-text", "*");
});

document.querySelector("[data-handler='connect-mcp']")?.addEventListener("click", () => {
    connectToMcpServer();
});

// Listen plugin.ts messages
window.addEventListener("message", (event) => {
    if (event.data.source === "penpot") {
        document.body.dataset.theme = event.data.theme;
    }
});
