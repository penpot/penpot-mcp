# Task Completion Guidelines

## After Making Code Changes

### 1. Build and Test
```bash
cd mcp-server
npm run build
```

### 2. Verify TypeScript Compilation
```bash
npx tsc --noEmit
```

### 3. Test the Server
```bash
# Start in development mode to test changes
npm run dev
```

### 4. Code Quality Checks
- Ensure all code follows the established conventions
- Verify JSDoc comments are complete and accurate
- Check that error handling is appropriate
- Ensure imports use correct .js extensions
- Validate that tool interfaces are properly implemented

### 5. Integration Testing
- Test tool registration in the main server
- Verify MCP protocol compliance
- Ensure tool definitions match implementation

## Before Committing Changes
1. **Build Successfully**: `npm run build` completes without errors
2. **No TypeScript Errors**: `npx tsc --noEmit` passes
3. **Documentation Updated**: JSDoc comments reflect changes
4. **Tool Registry Updated**: New tools added to `registerTools()` method
5. **Interface Compliance**: All tools implement the `Tool` interface correctly

## File Organization
- Place new tools in `src/tools/` directory
- Add interfaces to `src/interfaces/` if needed
- Update main server registration in `src/index.ts`
- Follow existing naming conventions

## Common Patterns
- All tools must implement the `Tool` interface
- Use readonly properties for tool definitions
- Include comprehensive error handling
- Follow the established documentation style
- Import with .js extensions for ES module compatibility
