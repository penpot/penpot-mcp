# Penpot MCP Server

A Model Context Protocol (MCP) server that provides Penpot integration 
capabilities for AI clients supporting the model context protocol (MCP).

## Setup

1. Install Dependencies

        npm install

2. Build the Project

        npm run build

3. Run the Server

        npm start

## Configuration

- `PENPOT_MCP_TASK_TIMEOUT_SECS` (default: `90`)
        - Timeout for plugin task execution.
        - Increase this value if page analysis is complex or large.

## Notes for Large Page Inspection

- `execute_code` now truncates oversized output to keep MCP/SSE responses stable.
- When inspecting large pages, prefer bounded queries such as `penpotUtils.shapeStructure(page.root, 3)` and split retrieval into chunks.


## Penpot Plugin API REPL

The MCP server includes a REPL interface for testing Penpot Plugin API calls.
To use it, connect to the URL reported at startup.