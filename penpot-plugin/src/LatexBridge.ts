/**
 * Bridge for LaTeX rendering requests.
 *
 * The Penpot plugin sandbox has no DOM, so KaTeX (which needs document/window for
 * layout measurement) cannot run there. We route render requests to the plugin UI
 * iframe (main.ts), which renders KaTeX and replies with measured glyphs.
 *
 * Wire-up:
 *   plugin sandbox  ──[penpot.ui.sendMessage {type:"latex-render", requestId, ...}]──>  UI iframe
 *   UI iframe       ──[parent.postMessage   {type:"latex-render-response", requestId,...}]──>  plugin sandbox
 *
 * On the plugin side, `penpot.ui.onMessage` is the single message entry — the bridge
 * exposes `handleLatexResponse` so the existing onMessage handler can short-circuit
 * latex responses without disturbing task-request routing.
 */

export interface LatexGlyph {
    text: string;
    x: number;
    y: number;
    fontSize: number;
    italic: boolean;
}

export interface LatexRenderResponse {
    type: "latex-render-response";
    requestId: string;
    glyphs?: LatexGlyph[];
    width?: number;
    height?: number;
    error?: string;
}

let _counter = 0;
const pending = new Map<string, (resp: LatexRenderResponse) => void>();

export function nextRequestId(): string {
    return "latex-" + (++_counter) + "-" + Date.now();
}

export function registerPending(id: string, cb: (resp: LatexRenderResponse) => void): void {
    pending.set(id, cb);
}

/**
 * If the incoming UI message is a latex render response, dispatch to the waiting
 * resolver and return true (consumed). Otherwise return false so the caller can
 * continue normal routing.
 */
export function handleLatexResponse(message: any): boolean {
    if (!message || typeof message !== "object") return false;
    if (message.type !== "latex-render-response") return false;
    const cb = pending.get(message.requestId);
    if (cb) {
        pending.delete(message.requestId);
        cb(message as LatexRenderResponse);
    }
    return true;
}
