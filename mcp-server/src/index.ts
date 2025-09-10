#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { Tool } from './interfaces/Tool.js';
import { HelloWorldTool } from './tools/HelloWorldTool.js';

/**
 * Main MCP server implementation for Penpot integration.
 * 
 * This server manages tool registration and execution using a clean
 * abstraction pattern that allows for easy extension with new tools.
 */
class PenpotMcpServer {
  private readonly server: Server;
  private readonly tools: Map<string, Tool>;

  /**
   * Creates a new Penpot MCP server instance.
   */
  constructor() {
    this.server = new Server(
      {
        name: 'penpot-mcp-server',
        version: '1.0.0',
        capabilities: {
          tools: {},
        },
      }
    );

    this.tools = new Map<string, Tool>();
    this.setupHandlers();
    this.registerTools();
  }

  /**
   * Registers all available tools with the server.
   * 
   * This method instantiates tool implementations and adds them to
   * the internal registry for later execution.
   */
  private registerTools(): void {
    const toolInstances: Tool[] = [
      new HelloWorldTool(),
    ];

    for (const tool of toolInstances) {
      this.tools.set(tool.definition.name, tool);
    }
  }

  /**
   * Sets up the MCP protocol request handlers.
   * 
   * Configures handlers for tool listing and execution requests
   * according to the MCP specification.
   */
  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: Array.from(this.tools.values()).map(tool => tool.definition),
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      const tool = this.tools.get(name);
      if (!tool) {
        throw new Error(`Tool "${name}" not found`);
      }

      try {
        return await tool.execute(args);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Tool execution failed: ${errorMessage}`);
      }
    });
  }

  /**
   * Starts the MCP server using stdio transport.
   * 
   * This method establishes the communication channel and begins
   * listening for MCP protocol messages.
   */
  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Penpot MCP Server started successfully');
  }
}

/**
 * Application entry point.
 * 
 * Creates and starts the MCP server instance, handling any startup errors
 * gracefully and ensuring proper process termination.
 */
async function main(): Promise<void> {
  try {
    const server = new PenpotMcpServer();
    await server.start();
    
    // Keep the process alive
    process.on('SIGINT', () => {
      console.error('Received SIGINT, shutting down gracefully...');
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      console.error('Received SIGTERM, shutting down gracefully...');
      process.exit(0);
    });
    
  } catch (error) {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  }
}

// Start the server if this file is run directly
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1].endsWith('index.js')) {
  main().catch((error) => {
    console.error('Unhandled error in main:', error);
    process.exit(1);
  });
}