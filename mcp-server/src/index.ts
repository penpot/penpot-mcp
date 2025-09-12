#!/usr/bin/env node

import { PenpotMcpServer } from "./PenpotMcpServer.js";

/**
 * Entry point for Penpot MCP Server
 *
 * Creates and starts the MCP server instance, handling any startup errors
 * gracefully and ensuring proper process termination.
 *
 * Usage:
 * - Default port: node dist/index.js (runs on 4401)
 * - Custom port: node dist/index.js --port 8080
 * - Help: node dist/index.js --help
 */

async function main(): Promise<void> {
    try {
        // Parse command line arguments for port configuration
        const args = process.argv.slice(2);
        let port = 4401; // Default port

        for (let i = 0; i < args.length; i++) {
            if (args[i] === "--port" || args[i] === "-p") {
                if (i + 1 < args.length) {
                    const portArg = parseInt(args[i + 1], 10);
                    if (!isNaN(portArg) && portArg > 0 && portArg <= 65535) {
                        port = portArg;
                    } else {
                        console.error("Invalid port number. Using default port 4401.");
                    }
                }
            } else if (args[i] === "--help" || args[i] === "-h") {
                console.log("Usage: node dist/index.js [options]");
                console.log("Options:");
                console.log("  --port, -p <number>    Port number for the HTTP/SSE server (default: 4401)");
                console.log("  --help, -h             Show this help message");
                process.exit(0);
            }
        }

        const server = new PenpotMcpServer(port);
        await server.start();

        // Keep the process alive
        process.on("SIGINT", () => {
            console.error("Received SIGINT, shutting down gracefully...");
            process.exit(0);
        });

        process.on("SIGTERM", () => {
            console.error("Received SIGTERM, shutting down gracefully...");
            process.exit(0);
        });
    } catch (error) {
        console.error("Failed to start MCP server:", error);
        process.exit(1);
    }
}

// Start the server if this file is run directly
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1].endsWith("index.js")) {
    main().catch((error) => {
        console.error("Unhandled error in main:", error);
        process.exit(1);
    });
}
