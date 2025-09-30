export class FileUtils {
    /**
     * Checks whether the given file path is absolute and raises an error if not.
     *
     * @param filePath - The file path to check
     */
    public static checkPathIsAbsolute(filePath: string): void {
        if (!require("path").isAbsolute(filePath)) {
            throw new Error(`The specified file path must be absolute: ${filePath}`);
        }
    }

    public static createParentDirectories(filePath: string): void {
        const path = require("path");
        const dir = path.dirname(filePath);
        if (!require("fs").existsSync(dir)) {
            require("fs").mkdirSync(dir, { recursive: true });
        }
    }

    /**
     * Writes binary data to a file at the specified path, creating the parent directories if necessary.
     *
     * @param filePath - The absolute path to the file where data should be written
     * @param bytes - The binary data to write to the file
     */
    public static writeBinaryFile(filePath: string, bytes: Uint8Array): void {
        this.createParentDirectories(filePath);
        require("fs").writeFileSync(filePath, Buffer.from(bytes));
    }

    /**
     * Writes text data to a file at the specified path, creating the parent directories if necessary.
     *
     * @param filePath - The absolute path to the file where data should be written
     * @param text - The text data to write to the file
     */
    public static writeTextFile(filePath: string, text: string): void {
        this.createParentDirectories(filePath);
        require("fs").writeFileSync(filePath, text, { encoding: "utf-8" });
    }
}
