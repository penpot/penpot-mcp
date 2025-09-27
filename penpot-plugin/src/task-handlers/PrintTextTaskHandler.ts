import { Task, TaskHandler } from "../TaskHandler";
import { PrintTextTaskParams } from "../../../common/src";

/**
 * Task handler for printing text to Penpot.
 */
export class PrintTextTaskHandler extends TaskHandler<PrintTextTaskParams> {
    readonly taskType = "printText";

    async handle(task: Task<PrintTextTaskParams>): Promise<void> {
        if (!task.params.text) {
            throw new Error("printText task requires 'text' parameter");
        }

        const text = penpot.createText(task.params.text);

        if (text) {
            // Center the text in the viewport
            text.x = penpot.viewport.center.x;
            text.y = penpot.viewport.center.y;

            // Select the newly created text
            penpot.selection = [text];

            console.log("Successfully created text:", task.params.text);
            task.sendSuccess({ textId: text.id });
        } else {
            throw new Error("Failed to create text element");
        }
    }
}
