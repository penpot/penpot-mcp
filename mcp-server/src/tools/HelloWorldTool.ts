import { IsString, IsNotEmpty } from "class-validator";
import { TypeSafeTool } from "../interfaces/Tool.js";
import "reflect-metadata";

/**
 * Arguments class for the HelloWorld tool with validation decorators.
 */
export class HelloWorldArgs {
    /**
     * The name to include in the greeting message.
     */
    @IsString({ message: "Name must be a string" })
    @IsNotEmpty({ message: "Name cannot be empty" })
    name!: string;
}

/**
 * Type-safe HelloWorld tool with automatic validation and schema generation.
 *
 * This tool directly implements the Tool interface while maintaining full
 * type safety through the protected executeTypeSafe method.
 */
export class HelloWorldTool extends TypeSafeTool<HelloWorldArgs> {
    constructor() {
        super(HelloWorldArgs);
    }

    protected getToolName(): string {
        return "hello_world";
    }

    protected getToolDescription(): string {
        return "Returns a personalized greeting message with the provided name";
    }

    /**
     * Executes the hello world functionality with type-safe, validated arguments.
     *
     * This method receives fully validated arguments with complete type safety.
     * No casting or manual validation is required.
     *
     * @param args - The validated HelloWorldArgs instance
     */
    protected async executeTypeSafe(
        args: HelloWorldArgs
    ): Promise<{ content: Array<{ type: string; text: string }> }> {
        return {
            content: [
                {
                    type: "text",
                    text: `Hello, ${args.name}! This greeting was generated with full type safety and automatic validation.`,
                },
            ],
        };
    }
}
