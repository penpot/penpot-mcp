# Penpot MCP Server

A Model Context Protocol (MCP) server that provides Penpot integration capabilities for Claude Desktop and other MCP-compatible clients.

## Overview

This MCP server implements a clean, object-oriented architecture that allows easy extension with new tools.
It currently includes a demonstration tool and provides a foundation for adding Penpot-specific functionality.

## Prerequisites

- Node.js 18+ 
- npm

## Installation & Setup

### 1. Install Dependencies

```bash
cd mcp-server
npm install
```

### 2. Build the Project

```bash
npm run build
```

### 3. Run the Server

**Development Mode** (with TypeScript compilation):
```bash
npm run dev
```

**Production Mode** (requires build first):
```bash
npm start
```

**With Custom Port**:
```bash
npm start -- --port 8080
# OR in development
npm run dev -- --port 8080
# OR directly
node dist/index.js --port 8080
```

**Available Options**:
- `--port, -p <number>`: Port number for the HTTP/SSE server (default: 4401)
- `--help, -h`: Show help message

## Available Commands

| Command | Description |
|---------|-------------|
| `npm install` | Install all dependencies |
| `npm run build` | Compile TypeScript to JavaScript |
| `npm run start` | Start the built server |
| `npm run dev` | Start in development mode with ts-node |
| `npm run format` | Format all files with Prettier |
| `npm run format:check` | Check if files are properly formatted |

## Claude Desktop Integration

The MCP server now supports both modern Streamable HTTP and legacy SSE transports, providing compatibility with various MCP clients.

### 1. Start the Server

First, build and start the MCP server:

```bash
cd mcp-server
npm run build
npm start
```

By default, the server runs on port 4401 and provides:
- **Modern Streamable HTTP endpoint**: `http://localhost:4401/mcp`
- **Legacy SSE endpoint**: `http://localhost:4401/sse`

### 2. Configure Claude Desktop

For Claude Desktop integration, you'll need to use a proxy since Claude Desktop requires stdio transport.

**Option A: Using mcp-remote (Recommended)**

Install mcp-remote globally if you haven't already:
```bash
npm install -g mcp-remote
```

Add this to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows**: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
    "mcpServers": {
        "penpot": {
            "command": "npx",
            "args": ["-y", "mcp-remote", "http://localhost:4401/sse", "--allow-http"]
        }
    }
}
```

**Option B: Direct HTTP Integration (for other MCP clients)**

For MCP clients that support HTTP transport directly, use:
- Modern clients: `http://localhost:4401/mcp`
- Legacy clients: `http://localhost:4401/sse`

### 3. Restart Claude Desktop

After updating the configuration file, restart Claude Desktop completely for the changes to take effect.

### 4. Verify Integration

Once Claude Desktop restarts, you should be able to use the MCP server's tools in your conversations. You can test with the included `hello_world` tool:

```
Can you use the hello_world tool to greet me?
```

## Adding New Tools

To add new tools to the MCP server:

1. **Create Tool Class**: Implement the `Tool` interface in `src/tools/`
2. **Register Tool**: Add your tool instance to the `registerTools()` method in `src/index.ts`
3. **Build**: Run `npm run build` to compile changes
4. **Restart**: Restart Claude Desktop to load the new functionality

Example tool implementation:

```typescript
import { Tool } from "../interfaces/Tool.js";
import { Tool as MCPTool } from "@modelcontextprotocol/sdk/types.js";

export class MyCustomTool implements Tool {
    readonly definition: MCPTool = {
        name: "my_tool",
        description: "Description of what this tool does",
        inputSchema: {
            type: "object",
            properties: {
                // Define your parameters here
            },
            required: [],
            additionalProperties: false,
        },
    };

    async execute(args: unknown): Promise<{ content: Array<{ type: string; text: string }> }> {
        // Implement your tool logic here
        return {
            content: [
                {
                    type: "text",
                    text: "Tool result",
                },
            ],
        };
    }
}
```

## Troubleshooting

### Server Won't Start
- Ensure all dependencies are installed: `npm install`
- Check that the project builds without errors: `npm run build`
- Verify Node.js version is 18 or higher: `node --version`

### Claude Desktop Can't Find Server
- Verify the absolute path in your configuration is correct
- Ensure the server is built (`npm run build`) before referencing `dist/index.js`
- Check that the JSON configuration file is valid
- Restart Claude Desktop completely after config changes

### Tools Not Available
- Confirm the server is listed in Claude Desktop's configuration
- Check the Claude Desktop console/logs for any error messages
- Verify tools are properly registered in the `registerTools()` method

## Development

This project uses:
- **TypeScript** for type safety and better development experience
- **Prettier** with 4-space indentation for consistent code formatting
- **ESM modules** for modern JavaScript compatibility
- **Object-oriented design** with the Strategy pattern for tool implementations

## License

MIT
