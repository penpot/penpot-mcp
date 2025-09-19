import {Task, TaskHandler} from "../TaskHandler";
import {ExecuteCodeTaskParams} from "../../../common/src";

/**
 * Task handler for executing JavaScript code in the plugin context.
 * 
 * Maintains a persistent context object that preserves state between code executions.
 */
export class ExecuteCodeTaskHandler extends TaskHandler<ExecuteCodeTaskParams> {
    readonly taskType = "executeCode";
    
    /**
     * Persistent context object that maintains state between code executions.
     * Contains the penpot API and any variables defined in executed code.
     */
    private readonly context: any;

    constructor() {
        super();

        // initialize context, making penpot object available
        this.context = {
            penpot: penpot,
            storage: {}
        };
    }

    handle(task: Task<ExecuteCodeTaskParams>): void {
        if (!task.params.code) {
            task.sendError("executeCode task requires 'code' parameter");
            return;
        }

        const context = this.context;
        const code = task.params.code;

        const result = (function (ctx) {
            return Function(...Object.keys(ctx), code)(...Object.values(ctx));
        })(context);

        console.log("Code execution result:", result);
        task.sendSuccess(result);
    }
}
