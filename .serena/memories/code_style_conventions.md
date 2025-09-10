# Code Style and Conventions

## General Principles
- **Object-Oriented Design**: Use idiomatic, object-oriented style with explicit abstractions
- **Strategy Pattern**: Prefer explicitly typed interfaces over bare functions for non-trivial functionality
- **Clean Architecture**: Tools implement a common interface for consistent registration and execution

## TypeScript Configuration
- **Strict Mode**: All strict TypeScript options enabled
- **Target**: ES2022
- **Module System**: CommonJS
- **Declaration Files**: Generated with source maps

## Naming Conventions
- **Classes**: PascalCase (e.g., `HelloWorldTool`, `PenpotMcpServer`)
- **Interfaces**: PascalCase (e.g., `Tool`)
- **Methods**: camelCase (e.g., `execute`, `registerTools`)
- **Constants**: camelCase for readonly properties (e.g., `definition`)
- **Files**: PascalCase for classes (e.g., `HelloWorldTool.ts`)

## Documentation Style
- **JSDoc**: Use comprehensive JSDoc comments for classes, methods, and interfaces
- **Description Format**: Initial elliptical phrase defines *what* it is, followed by details
- **Comment Style**: Start with lowercase for comments of code blocks (unless lengthy explanation with multiple sentences)

## Code Organization
- **Separation of Concerns**: Interfaces in separate directory from implementations
- **Tool Pattern**: All tools implement the `Tool` interface with `definition` and `execute` methods
- **Error Handling**: Comprehensive error handling with descriptive messages
- **Import Style**: Use explicit .js extensions for imports (required for ES modules)

## Examples
```typescript
/**
 * A simple demonstration tool that returns a greeting message.
 * 
 * This tool serves as a basic example of the Tool interface implementation
 * and provides a minimal "Hello, World!" functionality for testing purposes.
 */
export class HelloWorldTool implements Tool {
  /**
   * The tool definition as required by the MCP protocol.
   */
  readonly definition: MCPTool = {
    // configuration
  };

  /**
   * Executes the hello world functionality.
   * 
   * @param args - Tool arguments validated against schema
   * @returns A promise resolving to the execution result
   */
  async execute(args: unknown): Promise<ExecutionResult> {
    // implementation
  }
}
```
