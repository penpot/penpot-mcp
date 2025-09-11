# The Penpot MCP Server

The system consists of two main components:

1. **MCP Server** (`mcp-server/`): 
   - Runs the MCP server providing tools to an LLM for Penpot project interaction
   - Runs a WebSocket server which accepts connections from the Penpot MCP Plugin,
     establishing a communication channel between the plugin and the MCP server

2. **Penpot MCP Plugin** (`penpot-plugin/`):
   - Establishes WebSocket connection to the MCP server
   - Receives tasks from the MCP server, which it executes in the Penpot project, making
     use of the Penpot Plugin API

## Testing the Connection

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