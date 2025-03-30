import * as vscode from "vscode";
import * as path from "path";
import { 
    getFilesInDirectory, 
    isLwcFile, 
    getFileTypeDescription, 
    filterComponentFiles,
    getFilePriority
} from "../utils/fileUtils";

/**
 * Code Lens Provider for LWC component files
 */
export class LwcFileSwitcherCodeLensProvider implements vscode.CodeLensProvider {
    async provideCodeLenses(
        document: vscode.TextDocument,
        token: vscode.CancellationToken,
    ): Promise<vscode.CodeLens[]> {
        // Check if code lenses are enabled
        const config = vscode.workspace.getConfiguration("lwcFileSwitcher");
        if (!config.get("enableCodeLens", true)) {
            return [];
        }

        const filePath = document.uri.fsPath;

        // Only provide code lenses for files that might be part of an LWC component
        if (!isLwcFile(filePath)) {
            return [];
        }

        const baseName = path.basename(filePath);
        const componentName = baseName.endsWith(".js-meta.xml")
            ? baseName.replace(".js-meta.xml", "") // Handle XML config files
            : baseName.split(".")[0]; // Handle other files

        const directory = path.dirname(filePath);

        // Get all files in the current directory
        const files = await getFilesInDirectory(directory);

        // Filter files that belong to this component
        const componentFiles = filterComponentFiles(files, componentName, filePath);

        if (componentFiles.length === 0) {
            return [];
        }

        // Create a code lens at the top of the file
        const position = new vscode.Position(0, 0);
        const range = document.lineAt(0).range;

        // Create individual codelens for each component file
        const lenses: vscode.CodeLens[] = [];

        // Add a main code lens with a title
        lenses.push(
            new vscode.CodeLens(range, {
                title: "LWC Component Files:",
                command: "",
            }),
        );

        // Sort files by priority
        const sortedFiles = [...componentFiles].sort((a, b) => {
            const fileNameA = path.basename(a);
            const fileNameB = path.basename(b);
            return getFilePriority(fileNameA, a) - getFilePriority(fileNameB, b);
        });

        // Add individual file code lenses
        for (const file of sortedFiles) {
            const fileName = path.basename(file);
            const label = `${getFileTypeDescription(fileName, file)} (${fileName})`;

            lenses.push(
                new vscode.CodeLens(range, {
                    title: label,
                    command: "lwc-file-switcher.switchToFile",
                    arguments: [file],
                }),
            );
        }

        return lenses;
    }
} 