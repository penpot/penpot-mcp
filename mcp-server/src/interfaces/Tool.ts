import { Tool as MCPTool } from "@modelcontextprotocol/sdk/types.js";
import { validate, ValidationError } from "class-validator";
import { plainToClass } from "class-transformer";
import "reflect-metadata";
import { TextResponse, ToolResponse } from "./ToolResponse.js";
import type { PenpotMcpServer } from "../index.js";

/**
 * Base interface for MCP tool implementations.
 *
 * This interface maintains compatibility with the MCP protocol.
 * Most implementations should extend the Tool abstract class instead.
 */
export interface ToolInterface {
    /**
     * The tool's unique identifier and metadata definition.
     */
    readonly definition: MCPTool;

    /**
     * Executes the tool's primary functionality with provided arguments.
     *
     * @param args - The arguments passed to the tool (validated by implementation)
     * @returns A promise that resolves to the tool's execution result
     */
    execute(args: unknown): Promise<ToolResponse>;
}

/**
 * Metadata for schema generation from class properties.
 */
interface PropertyMetadata {
    type: "string" | "number" | "boolean" | "array" | "object";
    description: string;
    required: boolean;
}

/**
 * Base class for type-safe tools with automatic schema generation and validation.
 *
 * This class provides type safety through automatic validation and strongly-typed
 * protected methods. All tools should extend this class.
 *
 * @template TArgs - The strongly-typed arguments class for this tool
 */
export abstract class Tool<TArgs extends object> implements ToolInterface {
    private _definition: MCPTool | undefined;

    protected constructor(
        protected mcpServer: PenpotMcpServer,
        private ArgsClass: new () => TArgs
    ) {}

    /**
     * Gets the tool definition with automatically generated JSON schema.
     */
    get definition(): MCPTool {
        if (!this._definition) {
            this._definition = {
                name: this.getToolName(),
                description: this.getToolDescription(),
                inputSchema: this.generateInputSchema(),
            };
        }
        return this._definition;
    }

    /**
     * Executes the tool with automatic validation and type safety.
     *
     * This method handles the unknown args from the MCP protocol,
     * validates them, and delegates to the type-safe implementation.
     */
    async execute(args: unknown): Promise<ToolResponse> {
        try {
            // transform plain object to class instance
            const argsInstance = plainToClass(this.ArgsClass, args as object);

            // validate using class-validator decorators
            const errors = await validate(argsInstance);
            if (errors.length > 0) {
                const errorMessages = this.formatValidationErrors(errors);
                throw new Error(`Validation failed: ${errorMessages.join(", ")}`);
            }

            // execute the actual tool logic
            return await this.executeCore(argsInstance);
        } catch (error) {
            return new TextResponse(`Tool execution failed: ${String(error)}`);
        }
    }

    /**
     * Generates JSON schema from class-validator decorators and property metadata.
     */
    private generateInputSchema() {
        const instance = new this.ArgsClass();
        const properties: Record<string, any> = {};
        const required: string[] = [];

        const propertyNames = this.getPropertyNames(instance);

        for (const propName of propertyNames) {
            const metadata = this.getPropertyMetadata(this.ArgsClass, propName);
            properties[propName] = {
                type: metadata.type,
                description: metadata.description,
            };

            if (metadata.required) {
                required.push(propName);
            }
        }

        return {
            type: "object" as const,
            properties,
            required,
            additionalProperties: false,
        };
    }

    /**
     * Gets all property names from a class instance.
     */
    private getPropertyNames(instance: TArgs): string[] {
        const prototype = Object.getPrototypeOf(instance);
        const propertyNames: string[] = [];

        propertyNames.push(...Object.getOwnPropertyNames(instance));
        propertyNames.push(...Object.getOwnPropertyNames(prototype));

        return propertyNames.filter(
            (name) => name !== "constructor" && !name.startsWith("_") && typeof (instance as any)[name] !== "function"
        );
    }

    /**
     * Extracts property metadata from class-validator decorators.
     */
    private getPropertyMetadata(target: any, propertyKey: string): PropertyMetadata {
        const validationMetadata = Reflect.getMetadata("class-validator:storage", target) || {};
        const constraints = validationMetadata.validationMetadatas || [];

        let isRequired = true;
        let type: PropertyMetadata["type"] = "string";
        let description = `${propertyKey} parameter`;

        for (const constraint of constraints) {
            if (constraint.propertyName === propertyKey) {
                switch (constraint.type) {
                    case "isOptional":
                        isRequired = false;
                        break;
                    case "isString":
                        type = "string";
                        break;
                    case "isNumber":
                        type = "number";
                        break;
                    case "isBoolean":
                        type = "boolean";
                        break;
                    case "isArray":
                        type = "array";
                        break;
                }
            }
        }

        // Fallback type inference
        if (
            propertyKey.toLowerCase().includes("count") ||
            propertyKey.toLowerCase().includes("number") ||
            propertyKey.toLowerCase().includes("amount")
        ) {
            type = "number";
        }

        return { type, description, required: isRequired };
    }

    /**
     * Formats validation errors into human-readable messages.
     */
    private formatValidationErrors(errors: ValidationError[]): string[] {
        return errors.map((error) => {
            const constraints = Object.values(error.constraints || {});
            return `${error.property}: ${constraints.join(", ")}`;
        });
    }

    /**
     * Returns the tool's unique name.
     */
    protected abstract getToolName(): string;

    /**
     * Returns the tool's description.
     */
    protected abstract getToolDescription(): string;

    /**
     * Executes the tool's core logic.
     *
     * @param args - The (typed) tool arguments
     */
    protected abstract executeCore(args: TArgs): Promise<ToolResponse>;
}
