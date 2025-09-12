/**
 * Result of a plugin task execution.
 * 
 * Contains the outcome status of a task and any additional result data.
 */
export interface PluginTaskResult {
    /**
     * Whether the task completed successfully.
     */
    success: boolean;
    
    /**
     * Optional error message if the task failed.
     */
    error?: string;
    
    /**
     * Optional result data from the task execution.
     */
    data?: any;
}

/**
 * Request message sent from server to plugin.
 * 
 * Contains a unique identifier, task name, and parameters for execution.
 */
export interface PluginTaskRequest {
    /**
     * Unique identifier for request/response correlation.
     */
    id: string;
    
    /**
     * The name of the task to execute.
     */
    task: string;
    
    /**
     * The parameters for task execution.
     */
    params: any;
}

/**
 * Response message sent from plugin back to server.
 * 
 * Contains the original request ID and the execution result.
 */
export interface PluginTaskResponse {
    /**
     * Unique identifier matching the original request.
     */
    id: string;
    
    /**
     * The result of the task execution.
     */
    result: PluginTaskResult;
}

/**
 * Parameters for the printText task.
 */
export interface PrintTextTaskParams {
    /**
     * The text to be displayed in Penpot.
     */
    text: string;
}
