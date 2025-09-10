import { Tool } from '../interfaces/Tool.js';
import { Tool as MCPTool } from '@modelcontextprotocol/sdk/types.js';

/**
 * A simple demonstration tool that returns a personalized greeting message.
 * 
 * This tool serves as a basic example of the Tool interface implementation
 * and provides personalized "Hello, <name>!" functionality for testing purposes.
 */
export class HelloWorldTool implements Tool {
  /**
   * The tool definition as required by the MCP protocol.
   */
  readonly definition: MCPTool = {
    name: 'hello_world',
    description: 'Returns a personalized greeting message with the provided name',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'The name to include in the greeting message'
        }
      },
      required: ['name'],
      additionalProperties: false
    }
  };

  /**
   * Executes the hello world functionality with personalized greeting.
   * 
   * @param args - The tool arguments containing the name parameter
   * @returns A promise resolving to the personalized greeting message
   */
  async execute(args: unknown): Promise<{ content: Array<{ type: string; text: string }> }> {
    // Validate and extract the name from arguments
    const typedArgs = args as { name?: string };
    
    if (!typedArgs.name || typeof typedArgs.name !== 'string') {
      throw new Error('Name parameter is required and must be a string');
    }

    return {
      content: [
        {
          type: 'text',
          text: `Hello, ${typedArgs.name}!`
        }
      ]
    };
  }
}
