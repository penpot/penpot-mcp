# Penpot MCP Server

A Model Context Protocol (MCP) server that provides Penpot integration capabilities for Claude Desktop and other MCP-compatible clients.

## Prerequisites

- Node.js (tested with v20+)
- npm (with npx on the PATH)

## Installation & Setup

1. Install Dependencies

        cd mcp-server
        npm install

2. Build the Project

        npm run build

3. Run the Server

   - Development Mode (with TypeScript compilation):

         npm run dev

   - Production Mode (requires build first):

         npm start


### Summary of Commands

| Command                | Description                            |
| ---------------------- | -------------------------------------- |
| `npm install`          | Install all dependencies               |
| `npm run build`        | Compile TypeScript to JavaScript       |
| `npm run start`        | Start the built server                 |
| `npm run dev`          | Start in development mode with ts-node |
| `npm run format`       | Format all files with Prettier         |
| `npm run format:check` | Check if files are properly formatted  |


## Client Integration

The MCP server supports both Streamable HTTP and legacy SSE transports, providing compatibility with various MCP clients.

Note that we do not support stdio transport directly, as clients tend to spawn multiple instances of the MCP server,
and since the MCP server is also a WebSocket server, this would lead to port conflicts.
Therefore, we recommend using a proxy like `mcp-remote` for clients that support stdio transport only (e.g., Claude Desktop).

### Starting the Server

First, build and start the MCP server:

```bash
npm run build
npm start
```

By default, the server runs on port 4401 and provides:

- **Modern Streamable HTTP endpoint**: `http://localhost:4401/mcp`
- **Legacy SSE endpoint**: `http://localhost:4401/sse`

### Using a Proxy for stdio Transport

The `mcp-remote` package can proxy stdio transport to HTTP/SSE.

1. Install `mcp-remote` globally if you haven't already:

        npm install -g mcp-remote

2. Use `mcp-remote` to provide the launch command for your MCP client:

        npx -y mcp-remote http://localhost:4401/sse --allow-http

### Claude Desktop

For Claude Desktop integration, you will need to use a proxy like `mcp-remote` since it only supports stdio transport.
So install it as described above.

To add the server to Claude Desktop's configuration, locate the configuration file:

 - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`  
 - **Windows**: `%APPDATA%/Claude/claude_desktop_config.json`

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

After updating the configuration file, restart Claude Desktop completely for the changes to take effect.
Be sure to fully quit the app! On Windows, right-click the tray icon and select "Quit".

After the restart, you should see the MCP server listed when clicking on the "Search and tools" icon at the bottom
of the prompt input area.

### Other MCP Clients

For MCP clients that support HTTP transport directly, use:

- Streamable HTTP for modern clients: `http://localhost:4401/mcp`
- SSE for legacy clients: `http://localhost:4401/sse`

## Penpot Plugin API REPL

The MCP server includes a REPL interface for testing Penpot Plugin API calls.
To use it, connect to the URL reported at startup.