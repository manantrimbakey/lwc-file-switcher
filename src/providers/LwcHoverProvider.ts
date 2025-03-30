import * as vscode from "vscode";
import * as path from "path";
import { 
    getFilesInDirectory, 
    isLwcFile, 
    getFileTypeDescription, 
    getFileTypeClass,
    filterComponentFiles,
    getFilePriority
} from "../utils/fileUtils";

/**
 * Hover Provider for LWC component files
 */
export class LwcFileSwitcherHoverProvider implements vscode.HoverProvider {
    async provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
    ): Promise<vscode.Hover | null> {
        // Check if hover is enabled
        const config = vscode.workspace.getConfiguration("lwcFileSwitcher");
        if (!config.get("enableHover", true)) {
            return null;
        }

        // Only provide hover for the first few lines of the file
        if (position.line > 10) {
            return null;
        }

        const filePath = document.uri.fsPath;

        // Only provide hover for LWC file types
        if (!isLwcFile(filePath)) {
            return null;
        }

        const baseName = path.basename(filePath);
        const componentName = baseName.endsWith(".js-meta.xml")
            ? baseName.replace(".js-meta.xml", "") // Handle XML config files
            : baseName.split(".")[0]; // Handle other files

        // Check if the line contains the component name
        const lineText = document.lineAt(position.line).text;
        if (!lineText.includes(componentName)) {
            return null;
        }

        const directory = path.dirname(filePath);

        // Get all files in the current directory
        const files = await getFilesInDirectory(directory);

        // Filter files that belong to this component
        const componentFiles = filterComponentFiles(files, componentName, filePath);

        if (componentFiles.length === 0) {
            return null;
        }

        // Create the markdown content
        const markdownContent = new vscode.MarkdownString();
        markdownContent.isTrusted = true;
        markdownContent.supportHtml = true;

        markdownContent.appendMarkdown(`### LWC Component Files\n\n`);

        // Add CSS styles for the color indicators
        markdownContent.appendMarkdown(`<style>
			.hover-file-type {
				display: inline-block;
				margin-right: 5px;
				padding: 2px 5px;
				border-radius: 3px;
				font-weight: bold;
				font-size: 90%;
			}
			.hover-html { border-left: 3px solid #e44d26; background-color: rgba(228, 77, 38, 0.1); }
			.hover-js { border-left: 3px solid #f0db4f; background-color: rgba(240, 219, 79, 0.1); }
			.hover-css { border-left: 3px solid #264de4; background-color: rgba(38, 77, 228, 0.1); }
			.hover-xml { border-left: 3px solid #f16529; background-color: rgba(241, 101, 41, 0.1); }
			.hover-test { border-left: 3px solid #9c27b0; background-color: rgba(156, 39, 176, 0.1); }
			.hover-svg { border-left: 3px solid #ffb13b; background-color: rgba(255, 177, 59, 0.1); }
			.hover-other { border-left: 3px solid #607d8b; background-color: rgba(96, 125, 139, 0.1); }
		</style>\n\n`);

        // Sort files by priority
        const sortedFiles = [...componentFiles].sort((a, b) => {
            const fileNameA = path.basename(a);
            const fileNameB = path.basename(b);
            return getFilePriority(fileNameA, a) - getFilePriority(fileNameB, b);
        });

        for (const file of sortedFiles) {
            const fileName = path.basename(file);
            const fileType = getFileTypeDescription(fileName, file);
            const fileTypeClass = getFileTypeClass(fileName, file);
            const command = `command:lwc-file-switcher.switchToFile?${encodeURIComponent(JSON.stringify(file))}`;
            
            markdownContent.appendMarkdown(
                `- <span class="hover-file-type hover-${fileTypeClass}">${fileType}</span> [${fileName}](${command})\n`,
            );
        }

        return new vscode.Hover(markdownContent);
    }
} 