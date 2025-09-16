import {TaskHandler} from "../TaskHandler";
import {PrintTextTaskParams} from "../../../common/src";

/**
 * Task handler for printing text to Penpot.
 */
export class PrintTextTaskHandler extends TaskHandler<PrintTextTaskParams> {
    readonly task = "printText";

    /**
     * Handles the printText task by creating text in Penpot.
     *
     * @param taskId - The unique ID of the task request
     * @param params - The parameters containing the text to create
     */
    handle(taskId: string, params: PrintTextTaskParams): void {
        if (!params.text) {
            console.error("printText task requires 'text' parameter");
            TaskHandler.sendTaskError(taskId, "printText task requires 'text' parameter");
            return;
        }

        try {
            const text = penpot.createText(params.text);

            if (text) {
                // Center the text in the viewport
                text.x = penpot.viewport.center.x;
                text.y = penpot.viewport.center.y;

                // Select the newly created text
                penpot.selection = [text];

                console.log("Successfully created text:", params.text);
                TaskHandler.sendTaskSuccess(taskId, { textId: text.id });
            } else {
                console.error("Failed to create text element");
                TaskHandler.sendTaskError(taskId, "Failed to create text element");
            }
        } catch (error) {
            console.error("Error creating text:", error);
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            TaskHandler.sendTaskError(taskId, `Error creating text: ${errorMessage}`);
        }
    }
}