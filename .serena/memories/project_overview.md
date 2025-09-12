# Penpot MCP Project Overview - Updated

## Purpose
This project is a Model Context Protocol (MCP) server for Penpot integration. It provides a TypeScript-based server that can be used to extend Penpot's functionality through custom tools with bidirectional WebSocket communication.

## Tech Stack
- **Language**: TypeScript
- **Runtime**: Node.js
- **Framework**: MCP SDK (@modelcontextprotocol/sdk)
- **Build Tool**: TypeScript Compiler (tsc) + esbuild
- **Package Manager**: npm
- **WebSocket**: ws library for real-time communication

## Project Structure
```
penpot-mcp/
├── common/                     # NEW: Shared type definitions
│   ├── src/
│   │   ├── index.ts           # Exports for shared types
│   │   └── types.ts           # PluginTaskResult, request/response interfaces
│   └── package.json           # @penpot-mcp/common package
├── mcp-server/                # Main MCP server implementation
│   ├── src/
│   │   ├── index.ts           # Main server entry point
│   │   ├── PenpotMcpServer.ts # Enhanced with request/response correlation
│   │   ├── PluginTask.ts      # Now supports result promises
│   │   ├── tasks/             # Task implementations
│   │   │   └── PrintTextPluginTask.ts # Uses shared types
│   │   └── tools/             # Tool implementations
│   │       ├── HelloWorldTool.ts
│   │       └── PrintTextTool.ts # Now waits for task completion
│   └── package.json           # Includes @penpot-mcp/common dependency
└── penpot-plugin/             # Penpot plugin with response capability
    ├── src/
    │   ├── main.ts            # Enhanced WebSocket handling with response forwarding
    │   └── plugin.ts          # Now sends task responses back to server
    └── package.json           # Includes @penpot-mcp/common dependency
```

## Key Components - Updated

### Enhanced WebSocket Protocol
- **Request Format**: `{id: string, task: string, params: any}`
- **Response Format**: `{id: string, result: {success: boolean, error?: string, data?: any}}`
- **Request/Response Correlation**: Using unique UUIDs for task tracking
- **Timeout Handling**: 30-second timeout with automatic cleanup
- **Type Safety**: Shared definitions via @penpot-mcp/common package

### Core Classes
- **PenpotMcpServer**: Enhanced with pending task tracking and response handling
- **PluginTask**: Now creates result promises that resolve when plugin responds
- **Tool implementations**: Now properly await task completion and report results
- **Plugin handlers**: Send structured responses back to server

### New Features
1. **Bidirectional Communication**: Plugin now responds with success/failure status
2. **Task Result Promises**: Every executePluginTask() sets and returns a promise
3. **Error Reporting**: Failed tasks properly report error messages to tools
4. **Shared Type Safety**: Common package ensures consistency across projects
5. **Timeout Protection**: Tasks don't hang indefinitely (30s limit)
6. **Request Correlation**: Unique IDs match requests to responses

## Protocol Flow
```
LLM Tool Call → MCP Server → WebSocket (Request) → Plugin → Penpot API
                    ↑                                  ↓
             Tool Response ← MCP Server ← WebSocket (Response) ← Plugin Result
```

All components now properly handle the full request/response lifecycle with comprehensive error handling and type safety.
