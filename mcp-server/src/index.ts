#!/usr/bin/env node

import { PenpotMcpServer } from "./PenpotMcpServer";
import { createLogger, logFilePath } from "./logger";

/**
 * Entry point for Penpot MCP Server
 *
 * Creates and starts the MCP server instance, handling any startup errors
 * gracefully and ensuring proper process termination.
 *
 * Usage:
 * - Help: node dist/index.js --help
 * - Default configuration: runs on port 4401, logs to mcp-server/logs at info level
 */
async function main(): Promise<void> {
    const logger = createLogger("main");

    // log the file path early so it appears before any potential errors
    logger.info(`Logging to file: ${logFilePath}`);

    try {
        const args = process.argv.slice(2);
        let port = 4401; // default port

        // parse command line arguments
        for (let i = 0; i < args.length; i++) {
            if (args[i] === "--port" || args[i] === "-p") {
                if (i + 1 < args.length) {
                    const portArg = parseInt(args[i + 1], 10);
                    if (!isNaN(portArg) && portArg > 0 && portArg <= 65535) {
                        port = portArg;
                    } else {
                        logger.info("Invalid port number. Using default port 4401.");
                    }
                }
            } else if (args[i] === "--log-level" || args[i] === "-l") {
                if (i + 1 < args.length) {
                    process.env.LOG_LEVEL = args[i + 1];
                }
            } else if (args[i] === "--log-dir") {
                if (i + 1 < args.length) {
                    process.env.LOG_DIR = args[i + 1];
                }
            } else if (args[i] === "--help" || args[i] === "-h") {
                logger.info("Usage: node dist/index.js [options]");
                logger.info("Options:");
                logger.info("  --port, -p <number>    Port number for the HTTP/SSE server (default: 4401)");
                logger.info("  --log-level, -l <level> Log level: trace, debug, info, warn, error (default: info)");
                logger.info("  --log-dir <path>       Directory for log files (default: mcp-server/logs)");
                logger.info("  --help, -h             Show this help message");
                process.exit(0);
            }
        }

        const server = new PenpotMcpServer(port);
        await server.start();

        // keep the process alive
        process.on("SIGINT", async () => {
            logger.info("Received SIGINT, shutting down gracefully...");
            await server.stop();
            process.exit(0);
        });

        process.on("SIGTERM", async () => {
            logger.info("Received SIGTERM, shutting down gracefully...");
            await server.stop();
            process.exit(0);
        });
    } catch (error) {
        logger.error(error, "Failed to start MCP server");
        process.exit(1);
    }
}

// Start the server if this file is run directly
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1].endsWith("index.js")) {
    main().catch((error) => {
        createLogger("main").error(error, "Unhandled error in main");
        process.exit(1);
    });
}
