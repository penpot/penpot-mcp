# The Penpot MCP Server

This system enables LLMs to interact with Penpot design projects through a Model Context Protocol (MCP) server and plugin architecture.

## Quick Start

If it's your first execution, install and build all components before starting:
```shell
npm install
npm run install-all-and-start
```

Otherwise, just start all components:
```shell
npm run start
```

Then proceed with loading the plugin and connecting to the MCP server as described in [steps 3-4](#step-3-load-plugin-in-penpot)

You can also install and build the components without starting them:
```shell
npm run install-all
npm run build-all
```

## Architecture

The system consists of three main components:

1. **Common Types** (`common/`): 
   - Shared TypeScript definitions for request/response protocol
   - Ensures type safety across server and plugin components
   - Defines `PluginTaskResult`, request/response interfaces, and task parameters

2. **MCP Server** (`mcp-server/`): 
   - Provides MCP tools to LLMs for Penpot interaction
   - Runs WebSocket server accepting connections from Penpot plugins
   - Implements request/response correlation with unique task IDs
   - Handles task timeouts and proper error reporting

3. **Penpot Plugin** (`penpot-plugin/`):
   - Connects to MCP server via WebSocket
   - Executes tasks in Penpot using the Plugin API  
   - Sends structured responses back to server with success/failure status

## Protocol Flow

```
LLM → MCP Server → WebSocket → Penpot Plugin → Penpot API
     ↓                      ↓               ↓
   Tool Call          Task Request    Execute Action
     ↑                      ↑               ↑
LLM ← MCP Server ← WebSocket ← Penpot Plugin ← Result
```

### Request Format
```
{
  id: string,           // Unique UUID for correlation
  task: string,         // Task type (e.g., "printText")
  params: object        // Task-specific parameters
}
```

### Response Format  
```
{
  id: string,           // Matching request ID
  result: {
    success: boolean,   // Task completion status
    error?: string,     // Error message if failed
    data?: any         // Optional result data
  }
}
```

## Testing the Connection

For each component, run `npm install` before running other commands
if you haven't installed the component in the past.

### Step 0: Build the common components

```bash
cd common
npm run build
```

### Step 1: Start the MCP Server

```bash
cd mcp-server
npm run build
npm start
```

### Step 2: Build and Run the Plugin

```bash
cd penpot-plugin
npm run build
npm run dev
```

### Step 3: Load Plugin in Penpot

1. Open Penpot in your browser
2. Navigate to a design file
3. Go to Plugins menu
4. Load the plugin using the development URL (typically `http://localhost:4400/manifest.json`)
5. Open the plugin UI

### Step 4: Test the Connection

1. In the plugin UI, click "Connect to MCP server"
2. The connection status should change from "Not connected" to "Connected to MCP server"
3. Check the browser's developer console for WebSocket connection logs
4. Check the MCP server terminal for WebSocket connection messages

### Step 5: Use an MCP Client to Interact with the Penpot Project

See [MCP Server README](mcp-server/README.md)