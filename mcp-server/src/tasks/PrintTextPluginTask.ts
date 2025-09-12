import { PluginTask } from "../PluginTask";

/**
 * Parameters for the printText task.
 */
export class PrintTextPluginTaskParams {
    /**
     * The text to be displayed in Penpot.
     */
    public readonly text: string;

    constructor(text: string) {
        this.text = text;
    }
}

/**
 * Task for printing/creating text in Penpot.
 *
 * This task instructs the plugin to create a text element
 * at the viewport center and select it.
 */
export class PrintTextPluginTask extends PluginTask<PrintTextPluginTaskParams> {
    /**
     * Creates a new print text task.
     *
     * @param params - The parameters containing the text to print
     */
    constructor(params: PrintTextPluginTaskParams) {
        super("printText", params);
    }
}
