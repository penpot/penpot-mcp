# Penpot MCP Project Overview

## Purpose
This project is a Model Context Protocol (MCP) server for Penpot integration. It provides a TypeScript-based server that can be used to extend Penpot's functionality through custom tools.

## Tech Stack
- **Language**: TypeScript
- **Runtime**: Node.js
- **Framework**: MCP SDK (@modelcontextprotocol/sdk)
- **Build Tool**: TypeScript Compiler (tsc)
- **Package Manager**: npm

## Project Structure
```
penpot-mcp/
├── mcp-server/                 # Main MCP server implementation
│   ├── src/
│   │   ├── index.ts           # Main server entry point
│   │   ├── interfaces/        # Type definitions and contracts
│   │   │   └── Tool.ts        # Tool interface definition
│   │   └── tools/             # Tool implementations
│   │       └── HelloWorldTool.ts
│   ├── package.json           # Dependencies and scripts
│   └── tsconfig.json          # TypeScript configuration
└── penpot-plugin/             # Penpot plugin (currently empty)
```

## Key Components
- **PenpotMcpServer**: Main server class that manages tool registration and MCP protocol handling
- **Tool Interface**: Abstraction for all tool implementations
- **HelloWorldTool**: Example tool implementation demonstrating the pattern
