# WebSocket Connection Setup

This document explains how to test the basic WebSocket connection between the MCP server and the Penpot plugin.

## Architecture Overview

The system consists of two main components:

1. **MCP Server** (`mcp-server/`): 
   - Runs as a traditional MCP server (stdio transport)
   - Also runs a WebSocket server on port 8080
   - Basic WebSocket connection handling (protocol to be defined later)

2. **Penpot Plugin** (`penpot-plugin/`):
   - Contains a "Connect to MCP server" button in the UI
   - Establishes WebSocket connection to `ws://localhost:8080`
   - Basic connection status feedback

## Testing the Connection

### Step 1: Start the MCP Server
```bash
cd mcp-server
npm run build
npm start
```

The server will output:
```
Penpot MCP Server started successfully
WebSocket server is listening on ws://localhost:8080
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

### Step 4: Test the Connection
1. In the plugin UI, click "Connect to MCP server"
2. The connection status should change from "Not connected" to "Connected to MCP server"
3. Check the browser's developer console for WebSocket connection logs
4. Check the MCP server terminal for WebSocket connection messages

