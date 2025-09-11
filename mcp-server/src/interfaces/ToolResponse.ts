import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

type CallToolContent = CallToolResult["content"][number];
type TextItem = Extract<CallToolContent, { type: "text" }>;

class TextContent implements TextItem {
    [x: string]: unknown;
    readonly type = "text" as const;
    constructor(public text: string) {}
}

export class TextResponse implements CallToolResult {
    [x: string]: unknown;
    content: CallToolContent[]; // <- IMPORTANT: protocol’s union
    constructor(text: string) {
        this.content = [new TextContent(text)];
    }
}

export type ToolResponse = TextResponse;
