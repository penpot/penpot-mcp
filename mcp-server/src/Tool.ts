import { z } from "zod";
import "reflect-metadata";
import { TextResponse, ToolResponse } from "./ToolResponse";
import type { PenpotMcpServer } from "./PenpotMcpServer";
import { createLogger } from "./logger";

/**
 * An empty arguments class for tools that do not require any parameters.
 */
export class EmptyToolArgs {
    static schema = {};
}

/**
 * Base class for type-safe tools with automatic schema generation and validation.
 *
 * This class provides type safety through automatic validation and strongly-typed
 * protected methods. All tools should extend this class.
 *
 * @template TArgs - The strongly-typed arguments class for this tool
 */
export abstract class Tool<TArgs extends object> {
    private readonly logger = createLogger("Tool");

    protected constructor(
        protected mcpServer: PenpotMcpServer,
        private inputSchema: z.ZodRawShape
    ) {}

    /**
     * Executes the tool with automatic validation and type safety.
     *
     * This method handles the unknown args from the MCP protocol,
     * validates them, and delegates to the type-safe implementation.
     */
    async execute(args: unknown): Promise<ToolResponse> {
        try {
            this.logger.info("Executing tool: %s", this.getToolName());

            let argsInstance: TArgs = args as TArgs;
            this.logger.debug("Tool args: %o", argsInstance);

            // execute the actual tool logic
            let result = await this.executeCore(argsInstance);

            this.logger.info("Tool execution completed: %s", this.getToolName());
            return result;
        } catch (error) {
            this.logger.error(error);
            return new TextResponse(`Tool execution failed: ${String(error)}`);
        }
    }

    public getInputSchema() {
        return this.inputSchema;
    }

    /**
     * Returns the tool's unique name.
     */
    public abstract getToolName(): string;

    /**
     * Returns the tool's description.
     */
    public abstract getToolDescription(): string;

    /**
     * Executes the tool's core logic.
     *
     * @param args - The (typed) tool arguments
     */
    protected abstract executeCore(args: TArgs): Promise<ToolResponse>;
}
