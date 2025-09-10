import { Tool as MCPTool } from '@modelcontextprotocol/sdk/types.js';

/**
 * Defines the contract for MCP tool implementations.
 * 
 * This interface abstracts the common operations required for all tools
 * in the MCP server, providing a standardized way to register and execute
 * tool functionality.
 */
export interface Tool {
  /**
   * The tool's unique identifier and metadata definition.
   * 
   * This property contains the tool's name, description, and input schema
   * as required by the MCP protocol.
   */
  readonly definition: MCPTool;

  /**
   * Executes the tool's primary functionality with provided arguments.
   * 
   * @param args - The arguments passed to the tool, validated against the input schema
   * @returns A promise that resolves to the tool's execution result
   */
  execute(args: unknown): Promise<{ content: Array<{ type: string; text: string }> }>;
}
