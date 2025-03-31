import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

export const LWC_EXTENSIONS = [".html", ".js", ".css", ".js-meta.xml", ".svg", ".test.js"];

/**
 * Returns all files in a directory and its __tests__ subdirectory if it exists
 */
export async function getFilesInDirectory(directory: string): Promise<string[]> {
    try {
        // Get files in the main directory
        const mainDirFiles = await new Promise<string[]>((resolve, reject) => {
            fs.readdir(directory, (err, files) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(files.map((file) => path.join(directory, file)));
            });
        });

        // Check if __tests__ directory exists
        const testsDir = path.join(directory, "__tests__");
        let testFiles: string[] = [];

        try {
            // Check if the directory exists
            await fs.promises.access(testsDir, fs.constants.F_OK);

            // Get files in the __tests__ directory
            testFiles = await new Promise<string[]>((resolve, reject) => {
                fs.readdir(testsDir, (err, files) => {
                    if (err) {
                        resolve([]); // If we can't read the directory, just return empty array
                        return;
                    }
                    resolve(files.map((file) => path.join(testsDir, file)));
                });
            });
        } catch (e) {
            // __tests__ directory does not exist, continue with empty array
            testFiles = [];
        }

        // Combine and return all files
        return [...mainDirFiles, ...testFiles];
    } catch (err) {
        console.error("Error reading directory:", err);
        return [];
    }
}

/**
 * Returns a descriptive label for the file type
 */
export function getFileTypeDescription(fileName: string, filePath?: string): string {
    // Check if the file is in a __tests__ directory
    if (filePath && path.dirname(filePath).endsWith("__tests__")) {
        return "Test";
    }

    const ext = path.extname(fileName);
    switch (ext) {
        case ".html":
            return "Template";
        case ".js":
            if (fileName.endsWith(".test.js")) {
                return "Test";
            }
            return "JavaScript Controller";
        case ".css":
            return "Stylesheet";
        case ".js-meta.xml":
            return "Configuration";
        case ".svg":
            return "SVG Resource";
        default:
            return ext.substring(1).toUpperCase();
    }
}

/**
 * Returns a color for the file type
 */
export function getFileTypeColor(fileName: string): string {
    const ext = path.extname(fileName);
    switch (ext) {
        case ".html":
            return "#e44d26"; // HTML orange
        case ".js":
            if (fileName.endsWith(".test.js")) {
                return "#9c27b0"; // Purple for tests
            }
            return "#f0db4f"; // JavaScript yellow
        case ".css":
            return "#264de4"; // CSS blue
        case ".js-meta.xml":
            return "#f16529"; // XML orange-red
        case ".svg":
            return "#ffb13b"; // SVG amber
        default:
            return "#607d8b"; // Default gray
    }
}

/**
 * Returns a CSS class for the file type
 */
export function getFileTypeClass(fileName: string, filePath?: string): string {
    // Check if the file is in a __tests__ directory
    if (filePath && path.dirname(filePath).endsWith("__tests__")) {
        return "test";
    }

    const ext = path.extname(fileName);
    switch (ext) {
        case ".html":
            return "html";
        case ".js":
            if (fileName.endsWith(".test.js")) {
                return "test";
            }
            return "js";
        case ".css":
            return "css";
        case ".js-meta.xml":
            return "xml";
        case ".svg":
            return "svg";
        default:
            return "other";
    }
}

/**
 * Checks if a file is part of an LWC component by verifying:
 * 1. The component folder is inside an 'lwc' directory
 * 2. The component folder contains a .js-meta.xml file
 * 3. The file has a valid LWC extension
 */
export function isLwcFile(filePath: string): boolean {
    // Check if file is in an 'lwc' directory
    const normalizedPath = path.normalize(filePath);
    if (!normalizedPath.includes(path.sep + "lwc" + path.sep)) {
        return false;
    }

    const extName = path.extname(filePath);
    const directory = path.dirname(filePath);
    const componentName = path.basename(directory);

    // Check for valid LWC extension
    if (!LWC_EXTENSIONS.includes(extName) && !filePath.endsWith(".js-meta.xml")) {
        return false;
    }

    // Check for .js-meta.xml file in the component directory
    const metaFilePath = path.join(directory, `${componentName}.js-meta.xml`);
    try {
        return fs.existsSync(metaFilePath);
    } catch (error) {
        return false;
    }
}

/**
 * Returns a priority score for sorting file types
 * Lower score = higher priority (will appear earlier in lists)
 */
export function getFilePriority(fileName: string, filePath?: string): number {
    // Check if the file is in a __tests__ folder (lowest priority)
    if (filePath && path.dirname(filePath).endsWith("__tests__")) {
        return 100; // Lowest priority
    }

    const ext = path.extname(fileName);

    // Check for .js-meta.xml files (second lowest priority)
    if (fileName.endsWith(".js-meta.xml")) {
        return 90;
    }

    // Check for test files with .test.js extension (third lowest priority)
    if (fileName.endsWith(".test.js")) {
        return 80;
    }

    // Priorities for other file types
    switch (ext) {
        case ".html":
            return 10; // HTML templates (highest priority)
        case ".js":
            return 20; // JavaScript controllers
        case ".css":
            return 30; // CSS stylesheets
        case ".svg":
            return 40; // SVG resources
        default:
            return 50; // Other files
    }
}

/**
 * Filter files that belong to a component
 */
export function filterComponentFiles(files: string[], componentName: string, currentFilePath: string): string[] {
    return files.filter((file) => {
        const fileName = path.basename(file);
        const fileDir = path.dirname(file);

        // Check if it's a test file in the __tests__ folder
        if (fileDir.endsWith("__tests__")) {
            // For test files, check if they contain the component name
            return fileName.includes(componentName) && file !== currentFilePath;
        }

        // For regular files in the component folder
        return (
            (fileName.startsWith(componentName + ".") || fileName === `${componentName}.js-meta.xml`) &&
            file !== currentFilePath
        );
    });
}
