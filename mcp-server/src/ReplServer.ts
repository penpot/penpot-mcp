import express from "express";
import { PluginBridge } from "./PluginBridge";
import { ExecuteCodePluginTask } from "./tasks/ExecuteCodePluginTask";
import { createLogger } from "./logger";

/**
 * Web-based REPL server for executing code through the PluginBridge.
 *
 * Provides a simple HTML interface on port 4403 that allows users to input
 * JavaScript code and execute it via ExecuteCodePluginTask instances.
 * The interface displays the result member of ExecuteCodeTaskResultData.
 */
export class ReplServer {
    private readonly logger = createLogger("ReplServer");
    private readonly app: express.Application;
    private readonly port: number;
    private server: any;

    constructor(
        private readonly pluginBridge: PluginBridge,
        port: number = 4403
    ) {
        this.port = port;
        this.app = express();
        this.setupMiddleware();
        this.setupRoutes();
    }

    /**
     * Sets up Express middleware for request parsing and static content.
     */
    private setupMiddleware(): void {
        this.app.use(express.json());
        this.app.use(express.static("public")); // for serving static files if needed
    }

    /**
     * Sets up HTTP routes for the REPL interface and API endpoints.
     */
    private setupRoutes(): void {
        // serve the main REPL interface
        this.app.get("/", (req, res) => {
            res.send(this.getReplHtml());
        });

        // API endpoint for executing code
        this.app.post("/execute", async (req, res) => {
            try {
                const { code } = req.body;

                if (!code || typeof code !== "string") {
                    return res.status(400).json({
                        error: "Code parameter is required and must be a string",
                    });
                }

                const task = new ExecuteCodePluginTask({ code });
                const result = await this.pluginBridge.executePluginTask(task);

                // extract the result member from ExecuteCodeTaskResultData
                const executeResult = result.data?.result;

                res.json({
                    success: true,
                    result: executeResult,
                    log: result.data?.log || "",
                });
            } catch (error) {
                this.logger.error(error, "Failed to execute code in REPL");
                res.status(500).json({
                    error: error instanceof Error ? error.message : "Unknown error occurred",
                });
            }
        });
    }

    /**
     * Generates the HTML content for the REPL interface.
     *
     * Creates a simple web page with a resizable textarea for code input,
     * an execute button, and a results display area using jQuery.
     */
    private getReplHtml(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Penpot MCP REPL</title>
    <script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
    <style>
        body {
            font-family: 'Consolas', 'Monaco', 'Lucida Console', monospace;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        
        h1 {
            color: #333;
            text-align: center;
            margin-bottom: 30px;
        }
        
        #code-input {
            width: 100%;
            min-height: 200px;
            font-family: 'Consolas', 'Monaco', 'Lucida Console', monospace;
            font-size: 14px;
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 15px;
            resize: vertical;
            background-color: white;
            box-sizing: border-box;
        }
        
        #execute-btn {
            background-color: #007acc;
            color: white;
            border: none;
            padding: 12px 24px;
            font-size: 16px;
            border-radius: 4px;
            cursor: pointer;
            margin: 15px 0;
            font-family: inherit;
        }
        
        #execute-btn:hover {
            background-color: #005a9e;
        }
        
        #execute-btn:disabled {
            background-color: #ccc;
            cursor: not-allowed;
        }
        
        #results {
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 15px;
            background-color: white;
            min-height: 100px;
            white-space: pre-wrap;
            font-family: 'Consolas', 'Monaco', 'Lucida Console', monospace;
            font-size: 14px;
        }
        
        .error {
            color: #d63031;
            background-color: #fff5f5;
            border-color: #f5c6cb;
        }
        
        .success {
            color: #00b894;
            background-color: #f0fff4;
            border-color: #c3e6cb;
        }
        
        .loading {
            color: #fdcb6e;
            background-color: #fffbf0;
            border-color: #ffeeba;
        }
        
        .log-section {
            margin-top: 10px;
            padding-top: 10px;
            border-top: 1px solid #eee;
            color: #666;
            font-style: italic;
        }
        
        .controls {
            display: flex;
            gap: 10px;
            align-items: center;
            margin: 15px 0;
        }
        
        .shortcut-hint {
            color: #666;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <h1>Penpot MCP REPL</h1>
    
    <div>
        <label for="code-input">JavaScript Code:</label>
        <textarea id="code-input" placeholder="Enter your JavaScript code here...
// Example:
console.log('Hello from Penpot!');
return 'This will be the result';"></textarea>
    </div>
    
    <div class="controls">
        <button id="execute-btn">Execute Code</button>
        <span class="shortcut-hint">Shortcut: Ctrl+Enter</span>
    </div>
    
    <div>
        <label for="results">Results:</label>
        <div id="results">Click "Execute Code" to run your JavaScript...</div>
    </div>

    <script>
        $(document).ready(function() {
            let isExecuting = false;
            
            function setExecuting(executing) {
                isExecuting = executing;
                $('#execute-btn').prop('disabled', executing);
                $('#execute-btn').text(executing ? 'Executing...' : 'Execute Code');
            }
            
            function displayResult(data, isError = false) {
                const $results = $('#results');
                $results.removeClass('error success loading');
                
                if (isError) {
                    $results.addClass('error');
                    $results.text('Error: ' + data.error);
                } else {
                    $results.addClass('success');
                    
                    let output = '';
                    if (data.result !== undefined) {
                        output = 'Result: ' + JSON.stringify(data.result, null, 2);
                    } else {
                        output = 'Code executed successfully (no return value)';
                    }
                    
                    if (data.log && data.log.trim()) {
                        output += '\\n\\nConsole Output:\\n' + data.log;
                    }
                    
                    $results.text(output);
                }
            }
            
            function executeCode() {
                if (isExecuting) return;
                
                const code = $('#code-input').val().trim();
                if (!code) {
                    displayResult({ error: 'Please enter some code to execute' }, true);
                    return;
                }
                
                setExecuting(true);
                $('#results').removeClass('error success').addClass('loading').text('Executing code...');
                
                $.ajax({
                    url: '/execute',
                    method: 'POST',
                    contentType: 'application/json',
                    data: JSON.stringify({ code: code }),
                    success: function(data) {
                        displayResult(data, false);
                    },
                    error: function(xhr) {
                        let errorData;
                        try {
                            errorData = JSON.parse(xhr.responseText);
                        } catch {
                            errorData = { error: 'Network error or invalid response' };
                        }
                        displayResult(errorData, true);
                    },
                    complete: function() {
                        setExecuting(false);
                    }
                });
            }
            
            // bind execute button click
            $('#execute-btn').on('click', executeCode);
            
            // bind Ctrl+Enter keyboard shortcut
            $('#code-input').on('keydown', function(e) {
                if (e.ctrlKey && e.key === 'Enter') {
                    e.preventDefault();
                    executeCode();
                }
            });
            
            // auto-resize textarea based on content
            $('#code-input').on('input', function() {
                this.style.height = 'auto';
                this.style.height = Math.max(200, this.scrollHeight) + 'px';
            });
        });
    </script>
</body>
</html>`;
    }

    /**
     * Starts the REPL web server.
     *
     * Begins listening on the configured port and logs server startup information.
     */
    public async start(): Promise<void> {
        return new Promise((resolve) => {
            this.server = this.app.listen(this.port, () => {
                this.logger.info(`REPL server started on port ${this.port}`);
                this.logger.info(`REPL interface available at: http://localhost:${this.port}`);
                resolve();
            });
        });
    }

    /**
     * Stops the REPL web server.
     */
    public async stop(): Promise<void> {
        if (this.server) {
            return new Promise((resolve) => {
                this.server.close(() => {
                    this.logger.info("REPL server stopped");
                    resolve();
                });
            });
        }
    }
}
