import "./style.css";
import katex from "katex/dist/katex.mjs";
import "katex/dist/katex.min.css";

// get the current theme from the URL
const searchParams = new URLSearchParams(window.location.search);
document.body.dataset.theme = searchParams.get("theme") ?? "light";

// Determine whether multi-user mode is enabled based on URL parameters
const isMultiUserMode = searchParams.get("multiUser") === "true";
console.log("Penpot MCP multi-user mode:", isMultiUserMode);

// WebSocket connection management
let ws: WebSocket | null = null;
const statusElement = document.getElementById("connection-status");

// Keepalive / auto-reconnect state
let keepaliveTimer: number | null = null;
let reconnectTimer: number | null = null;
let userClosed = false;  // true if user intentionally closed; auto-reconnect skipped
const KEEPALIVE_INTERVAL_MS = 25_000;   // < 90s plugin-side idle threshold
const RECONNECT_DELAY_MS = 3_000;

function stopKeepalive(): void {
    if (keepaliveTimer !== null) {
        clearInterval(keepaliveTimer);
        keepaliveTimer = null;
    }
}

function startKeepalive(): void {
    stopKeepalive();
    keepaliveTimer = window.setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            try {
                // Application-level ping; server ignores unknown id.
                ws.send(JSON.stringify({ __keepalive: true, ts: Date.now() }));
            } catch (e) {
                console.warn("keepalive send failed:", e);
            }
        }
    }, KEEPALIVE_INTERVAL_MS);
}

function scheduleReconnect(): void {
    if (userClosed) return;
    if (reconnectTimer !== null) return;
    reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        console.log("Auto-reconnecting to MCP server…");
        connectToMcpServer();
    }, RECONNECT_DELAY_MS);
}

/**
 * Updates the connection status display element.
 *
 * @param status - the base status text to display
 * @param isConnectedState - whether the connection is in a connected state (affects color)
 * @param message - optional additional message to append to the status
 */
function updateConnectionStatus(status: string, isConnectedState: boolean, message?: string): void {
    if (statusElement) {
        const displayText = message ? `${status}: ${message}` : status;
        statusElement.textContent = displayText;
        statusElement.style.color = isConnectedState ? "var(--accent-primary)" : "var(--error-700)";
    }
}

/**
 * Sends a task response back to the MCP server via WebSocket.
 *
 * @param response - The response containing task ID and result
 */
function sendTaskResponse(response: any): void {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(response));
        console.log("Sent response to MCP server:", response);
    } else {
        console.error("WebSocket not connected, cannot send response");
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
        let wsUrl = PENPOT_MCP_WEBSOCKET_URL;
        if (isMultiUserMode) {
            // TODO obtain proper userToken from penpot
            const userToken = "dummyToken";
            wsUrl += `?userToken=${encodeURIComponent(userToken)}`;
        }
        ws = new WebSocket(wsUrl);
        updateConnectionStatus("Connecting...", false);

        ws.onopen = () => {
            console.log("Connected to MCP server");
            updateConnectionStatus("Connected to MCP server", true);
            userClosed = false;
            startKeepalive();
        };

        ws.onmessage = (event) => {
            console.log("Received from MCP server:", event.data);
            try {
                const request = JSON.parse(event.data);
                // Forward the task request to the plugin for execution
                parent.postMessage(request, "*");
            } catch (error) {
                console.error("Failed to parse WebSocket message:", error);
            }
        };

        ws.onclose = (event: CloseEvent) => {
            console.log("Disconnected from MCP server (code=" + event.code + ")");
            const message = event.reason || undefined;
            updateConnectionStatus(userClosed ? "Disconnected" : "Reconnecting…", false, message);
            ws = null;
            stopKeepalive();
            scheduleReconnect();
        };

        ws.onerror = (error) => {
            console.error("WebSocket error:", error);
            // note: WebSocket error events typically don't contain detailed error messages
            updateConnectionStatus("Connection error", false);
        };
    } catch (error) {
        console.error("Failed to connect to MCP server:", error);
        const message = error instanceof Error ? error.message : undefined;
        updateConnectionStatus("Connection failed", false, message);
    }
}

document.querySelector("[data-handler='connect-mcp']")?.addEventListener("click", () => {
    connectToMcpServer();
});

// Listen plugin.ts messages
window.addEventListener("message", (event) => {
    const data = event.data;
    if (!data || typeof data !== "object") return;
    if (data.source === "penpot") {
        document.body.dataset.theme = data.theme;
    } else if (data.type === "task-response") {
        // Forward task response back to MCP server
        sendTaskResponse(data.response);
    } else if (data.type === "latex-render") {
        handleLatexRender(data).catch((err) => {
            const msg = err instanceof Error ? err.message : String(err);
            console.error("latex-render error:", msg);
            parent.postMessage(
                { type: "latex-render-response", requestId: data.requestId, error: msg },
                "*",
            );
        });
    }
});

// ---- LaTeX rendering bridge (server side) ---------------------------------
//
// The plugin sandbox has no DOM, so we render KaTeX here (UI iframe) and reply
// with measured glyphs that the plugin can turn into Penpot text nodes.

let _katexFontsReady = false;

async function ensureKatexFonts(): Promise<void> {
    if (_katexFontsReady) return;
    try {
        await (document as any).fonts?.ready;
    } catch (_e) {
        // ignore — fall through with whatever metrics the browser has
    }
    _katexFontsReady = true;
}

async function handleLatexRender(req: {
    requestId: string;
    tex: string;
    opts?: { fontSize?: number; display?: boolean };
}): Promise<void> {
    await ensureKatexFonts();
    const fontSize = req.opts?.fontSize ?? 16;
    const display = req.opts?.display !== false;

    let html: string;
    try {
        html = (katex as any).renderToString(req.tex, {
            displayMode: display,
            throwOnError: false,
            output: "html",
        });
    } catch (e: any) {
        parent.postMessage(
            {
                type: "latex-render-response",
                requestId: req.requestId,
                error: `KaTeX render failed: ${e?.message ?? String(e)}`,
            },
            "*",
        );
        return;
    }

    const tmp = document.createElement("div");
    tmp.style.cssText =
        `position:absolute;left:-9999px;top:-9999px;font-size:${fontSize}px;visibility:hidden;`;
    tmp.innerHTML = html;
    document.body.appendChild(tmp);

    // Force layout by reading bounds.
    const baseRect = tmp.getBoundingClientRect();

    const glyphs: Array<{ text: string; x: number; y: number; fontSize: number; italic: boolean }> = [];

    const walk = (node: Element): void => {
        if (node.children.length === 0) {
            const txt = node.textContent ?? "";
            if (txt.trim().length > 0) {
                const rect = node.getBoundingClientRect();
                const cs = window.getComputedStyle(node);
                const sz = parseFloat(cs.fontSize) || fontSize;
                const ff = cs.fontFamily || "";
                const italic = cs.fontStyle === "italic" || ff.includes("KaTeX_Math");
                glyphs.push({
                    text: txt,
                    x: rect.left - baseRect.left,
                    y: rect.top - baseRect.top,
                    fontSize: sz,
                    italic,
                });
            }
        } else {
            for (const c of Array.from(node.children)) walk(c as Element);
        }
    };

    if (tmp.firstElementChild) walk(tmp.firstElementChild);

    const finalRect = tmp.getBoundingClientRect();
    document.body.removeChild(tmp);

    parent.postMessage(
        {
            type: "latex-render-response",
            requestId: req.requestId,
            glyphs,
            width: finalRect.width,
            height: finalRect.height,
        },
        "*",
    );
}
