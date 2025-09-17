import { PluginTask } from "../PluginTask";
import { PrintTextTaskParams, PluginTaskResult } from "@penpot-mcp/common";

/**
 * Task for printing/creating text in Penpot.
 *
 * This task instructs the plugin to create a text element
 * at the viewport center and select it.
 */
export class PrintTextPluginTask extends PluginTask<PrintTextTaskParams, PluginTaskResult<any>> {
    /**
     * Creates a new print text task.
     *
     * @param params - The parameters containing the text to print
     */
    constructor(params: PrintTextTaskParams) {
        super("printText", params);
    }
}
