import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

type CallToolContent = CallToolResult["content"][number];
type TextItem = Extract<CallToolContent, { type: "text" }>;
type ImageItem = Extract<CallToolContent, { type: "image" }>;

class TextContent implements TextItem {
    [x: string]: unknown;
    readonly type = "text" as const;
    constructor(public text: string) {}
}

class ImageContent implements ImageItem {
    [x: string]: unknown;
    readonly type = "image" as const;

    /**
     * @param data - Base64-encoded image data
     * @param mimeType - MIME type of the image (e.g., "image/png")
     */
    constructor(
        public data: string,
        public mimeType: string
    ) {}
}

class PNGImageContent extends ImageContent {
    constructor(data: Uint8Array) {
        super(Buffer.from(data).toString("base64"), "image/png");
    }
}

export class ToolResponse implements CallToolResult {
    [x: string]: unknown;
    content: CallToolContent[]; // <- IMPORTANT: protocol’s union
    constructor(content: CallToolContent[]) {
        this.content = content;
    }
}

export class TextResponse extends ToolResponse {
    constructor(text: string) {
        super([new TextContent(text)]);
    }
}
