import * as vscode from "vscode";
import * as path from "path";
import {
    getFilesInDirectory,
    isLwcFile,
    getFileTypeDescription,
    getFileTypeColor,
    getFileTypeClass,
    filterComponentFiles,
    getFilePriority,
} from "../utils/fileUtils";

/**
 * WebviewView Provider for LWC file switching
 */
export class LwcFileListProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private _extensionUri: vscode.Uri;

    constructor(extensionUri: vscode.Uri) {
        this._extensionUri = extensionUri;
    }

    async resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        // Allow scripts in the webview
        webviewView.webview.options = {
            enableScripts: true,
        };

        // Set initial HTML content
        webviewView.webview.html = this._getInitialHtml();

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage((message) => {
            switch (message.command) {
                case "switchToFile":
                    vscode.commands.executeCommand("lwc-file-switcher.switchToFile", message.filePath);
                    break;
            }
        });

        // Update the file list when the view becomes visible
        if (webviewView.visible) {
            await this.updateFileList(vscode.window.activeTextEditor);
        }
    }

    /**
     * Updates the file list in the webview
     */
    async updateFileList(editor: vscode.TextEditor | undefined) {
        if (!this._view || !this._view.visible) {
            return;
        }

        // If no editor is active, show the initial state
        if (!editor) {
            this._view.webview.html = this._getInitialHtml();
            return;
        }

        const filePath = editor.document.uri.fsPath;
        const extName = path.extname(filePath);

        // Get the base name and component name
        const baseName = path.basename(filePath);
        const componentName = baseName.endsWith(".js-meta.xml")
            ? baseName.replace(".js-meta.xml", "") // Handle XML config files
            : baseName.split(".")[0]; // Handle other files

        // Only update for LWC file types
        if (!isLwcFile(filePath)) {
            this._view.webview.html = this._getNoComponentHtml("Not an LWC component file");
            return;
        }

        // Get all files in the directory
        const directory = path.dirname(filePath);
        const files = await getFilesInDirectory(directory);

        // Filter files that belong to this component
        const componentFiles = filterComponentFiles(files, componentName, filePath);

        if (componentFiles.length === 0) {
            this._view.webview.html = this._getNoComponentHtml("No other component files found");
            return;
        }

        // Get a list of all dirty documents (unsaved changes)
        const dirtyDocuments = vscode.workspace.textDocuments.filter((doc) => doc.isDirty).map((doc) => doc.uri.fsPath);

        // Update the webview with component files
        this._view.webview.html = this._getHtmlForComponentFiles(
            componentName,
            path.basename(filePath),
            componentFiles,
            dirtyDocuments,
            editor.document.isDirty,
        );
    }

    /**
     * Returns the initial HTML for the webview
     */
    private _getInitialHtml() {
        return `<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>LWC File Switcher</title>
			<style>
				body {
					padding: 8px;
					margin: 0;
					font-family: var(--vscode-font-family);
					font-size: var(--vscode-font-size);
					color: var(--vscode-editor-foreground);
				}
				.component-header {
					margin-bottom: 8px;
					font-weight: bold;
				}
				.component-name {
					color: var(--vscode-textLink-foreground);
				}
				.file-list {
					display: flex;
					flex-direction: column;
					gap: 5px;
				}
				.file-button {
					display: flex;
					justify-content: space-between;
					align-items: center;
					padding: 4px 8px;
					background-color: var(--vscode-list-hoverBackground, rgba(0, 0, 0, 0.05));
					color: var(--vscode-editor-foreground);
					border: 1px solid var(--vscode-list-focusOutline, transparent);
					border-radius: 2px;
					cursor: pointer;
					text-align: left;
					transition: background-color 0.2s;
				}
				.file-button:hover {
					background-color: var(--vscode-list-activeSelectionBackground);
					color: var(--vscode-list-activeSelectionForeground);
				}
				.file-type {
					font-size: 90%;
					padding: 2px 6px;
					border-radius: 3px;
					font-weight: 500;
					display: flex;
					align-items: center;
					color: var(--vscode-editor-foreground);
				}
				.file-type-indicator {
					width: 8px;
					height: 8px;
					border-radius: 50%;
					display: inline-block;
					margin-right: 4px;
				}
				.file-type-html .file-type-indicator { background-color: #e44d26; }
				.file-type-html { color: var(--vscode-symbolIcon-colorForeground); }
				
				.file-type-js .file-type-indicator { background-color: #f0db4f; }
				.file-type-js { color: var(--vscode-symbolIcon-colorForeground); }
				
				.file-type-css .file-type-indicator { background-color: #264de4; }
				.file-type-css { color: var(--vscode-symbolIcon-colorForeground); }
				
				.file-type-xml .file-type-indicator { background-color: #f16529; }
				.file-type-xml { color: var(--vscode-symbolIcon-colorForeground); }
				
				.file-type-test .file-type-indicator { background-color: #9c27b0; }
				.file-type-test { color: var(--vscode-symbolIcon-colorForeground); }
				
				.file-type-svg .file-type-indicator { background-color: #ffb13b; }
				.file-type-svg { color: var(--vscode-symbolIcon-colorForeground); }
				
				.file-type-other .file-type-indicator { background-color: #607d8b; }
				.file-type-other { color: var(--vscode-symbolIcon-colorForeground); }
				
				.unsaved-indicator {
					color: var(--vscode-editorInfo-foreground, #75beff);
					font-size: 12px;
					font-weight: bold;
					margin-left: 4px;
					display: inline-block;
					vertical-align: middle;
					animation: pulse 2s infinite;
					opacity: 0.8;
				}
				@keyframes pulse {
					0% { opacity: 0.6; }
					50% { opacity: 1; }
					100% { opacity: 0.6; }
				}
				.file-name {
					color: inherit;
				}
				.no-files {
					color: var(--vscode-disabledForeground);
					font-style: italic;
				}
			</style>
		</head>
		<body>
			<div class="component-header">Select an LWC component file</div>
		</body>
		</html>`;
    }

    /**
     * Returns the HTML for the webview when no component files are found
     */
    private _getNoComponentHtml(message: string) {
        return `<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>LWC File Switcher</title>
			<style>
				body {
					padding: 8px;
					margin: 0;
					font-family: var(--vscode-font-family);
					font-size: var(--vscode-font-size);
					color: var(--vscode-editor-foreground);
				}
				.component-header {
					margin-bottom: 8px;
					font-weight: bold;
				}
				.file-button {
					display: flex;
					justify-content: space-between;
					align-items: center;
					padding: 4px 8px;
					background-color: var(--vscode-list-hoverBackground, rgba(0, 0, 0, 0.05));
					color: var(--vscode-editor-foreground);
					border: 1px solid var(--vscode-list-focusOutline, transparent);
					border-radius: 2px;
					cursor: pointer;
					text-align: left;
					transition: background-color 0.2s;
				}
				.file-button:hover {
					background-color: var(--vscode-list-activeSelectionBackground);
					color: var(--vscode-list-activeSelectionForeground);
				}
				.file-type {
					font-size: 90%;
					padding: 2px 6px;
					border-radius: 3px;
					font-weight: 500;
					display: flex;
					align-items: center;
					color: var(--vscode-editor-foreground);
				}
				.file-type-indicator {
					width: 8px;
					height: 8px;
					border-radius: 50%;
					display: inline-block;
					margin-right: 4px;
				}
				.file-type-html .file-type-indicator { background-color: #e44d26; }
				.file-type-html { color: var(--vscode-symbolIcon-colorForeground); }
				
				.file-type-js .file-type-indicator { background-color: #f0db4f; }
				.file-type-js { color: var(--vscode-symbolIcon-colorForeground); }
				
				.file-type-css .file-type-indicator { background-color: #264de4; }
				.file-type-css { color: var(--vscode-symbolIcon-colorForeground); }
				
				.file-type-xml .file-type-indicator { background-color: #f16529; }
				.file-type-xml { color: var(--vscode-symbolIcon-colorForeground); }
				
				.file-type-test .file-type-indicator { background-color: #9c27b0; }
				.file-type-test { color: var(--vscode-symbolIcon-colorForeground); }
				
				.file-type-svg .file-type-indicator { background-color: #ffb13b; }
				.file-type-svg { color: var(--vscode-symbolIcon-colorForeground); }
				
				.file-type-other .file-type-indicator { background-color: #607d8b; }
				.file-type-other { color: var(--vscode-symbolIcon-colorForeground); }
				
				.no-files {
					color: var(--vscode-disabledForeground);
					font-style: italic;
				}
			</style>
		</head>
		<body>
			<div class="component-header">LWC File Switcher</div>
			<div class="no-files">${message}</div>
		</body>
		</html>`;
    }

    /**
     * Returns the HTML for the webview with component files
     */
    private _getHtmlForComponentFiles(
        componentName: string,
        currentFile: string,
        files: string[],
        dirtyDocuments: string[],
        isCurrentFileDirty: boolean,
    ) {
        let fileButtons = "";

        // Get current file path from basename
        const currentFilePath = path.join(path.dirname(files[0] || ""), currentFile);
        // Get file type and color for current file
        const currentFileType = getFileTypeDescription(currentFile, currentFilePath);
        const currentFileColor = getFileTypeColor(currentFile);

        // Sort files by priority
        const sortedFiles = [...files].sort((a, b) => {
            const fileNameA = path.basename(a);
            const fileNameB = path.basename(b);
            return getFilePriority(fileNameA, a) - getFilePriority(fileNameB, b);
        });

        for (const file of sortedFiles) {
            const fileName = path.basename(file);
            const fileType = getFileTypeDescription(fileName, file);
            const fileColor = getFileTypeColor(fileName);
            const isDirty = dirtyDocuments.includes(file);

            fileButtons += `
				<button class="file-button" data-path="${file}">
					<span class="file-name">${fileName}${isDirty ? ' <span class="unsaved-indicator">●</span>' : ""}</span>
					<span class="file-type file-type-${getFileTypeClass(fileName, file)}">
						<span class="file-type-indicator"></span>
						<span>${fileType}</span>
					</span>
				</button>`;
        }

        return `<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>LWC File Switcher</title>
			<style>
				body {
					padding: 8px;
					margin: 0;
					font-family: var(--vscode-font-family);
					font-size: var(--vscode-font-size);
					color: var(--vscode-editor-foreground);
				}
				.component-header {
					margin-bottom: 8px;
					font-weight: bold;
				}
				.component-name {
					color: var(--vscode-textLink-foreground);
				}
				.current-file {
					font-size: 90%;
					margin-bottom: 10px;
					display: flex;
					align-items: center;
					gap: 4px;
				}
				.current-file-label {
					opacity: 0.8;
				}
				.file-list {
					display: flex;
					flex-direction: column;
					gap: 5px;
				}
				.file-button {
					display: flex;
					justify-content: space-between;
					align-items: center;
					padding: 4px 8px;
					background-color: var(--vscode-list-hoverBackground, rgba(0, 0, 0, 0.05));
					color: var(--vscode-editor-foreground);
					border: 1px solid var(--vscode-list-focusOutline, transparent);
					border-radius: 2px;
					cursor: pointer;
					text-align: left;
					transition: background-color 0.2s;
				}
				.file-button:hover {
					background-color: var(--vscode-list-activeSelectionBackground);
					color: var(--vscode-list-activeSelectionForeground);
				}
				.file-type {
					font-size: 90%;
					padding: 2px 6px;
					border-radius: 3px;
					font-weight: 500;
					display: flex;
					align-items: center;
					color: var(--vscode-editor-foreground);
				}
				.file-type-indicator {
					width: 8px;
					height: 8px;
					border-radius: 50%;
					display: inline-block;
					margin-right: 4px;
				}
				.file-type-html .file-type-indicator { background-color: #e44d26; }
				.file-type-html { color: var(--vscode-symbolIcon-colorForeground); }
				
				.file-type-js .file-type-indicator { background-color: #f0db4f; }
				.file-type-js { color: var(--vscode-symbolIcon-colorForeground); }
				
				.file-type-css .file-type-indicator { background-color: #264de4; }
				.file-type-css { color: var(--vscode-symbolIcon-colorForeground); }
				
				.file-type-xml .file-type-indicator { background-color: #f16529; }
				.file-type-xml { color: var(--vscode-symbolIcon-colorForeground); }
				
				.file-type-test .file-type-indicator { background-color: #9c27b0; }
				.file-type-test { color: var(--vscode-symbolIcon-colorForeground); }
				
				.file-type-svg .file-type-indicator { background-color: #ffb13b; }
				.file-type-svg { color: var(--vscode-symbolIcon-colorForeground); }
				
				.file-type-other .file-type-indicator { background-color: #607d8b; }
				.file-type-other { color: var(--vscode-symbolIcon-colorForeground); }
				
				.unsaved-indicator {
					color: var(--vscode-editorInfo-foreground, #75beff);
					font-size: 12px;
					font-weight: bold;
					margin-left: 4px;
					display: inline-block;
					vertical-align: middle;
					animation: pulse 2s infinite;
					opacity: 0.8;
				}
				@keyframes pulse {
					0% { opacity: 0.6; }
					50% { opacity: 1; }
					100% { opacity: 0.6; }
				}
				.file-name {
					color: inherit;
				}
			</style>
		</head>
		<body>
			<div class="component-header">Component: <span class="component-name">${componentName}</span></div>
			<div class="current-file">
				<span class="current-file-label">Current:</span> 
				${currentFile}${isCurrentFileDirty ? ' <span class="unsaved-indicator">●</span>' : ""}
				<span class="file-type file-type-${getFileTypeClass(currentFile, currentFilePath)}" style="margin-left: auto;">
					<span class="file-type-indicator"></span>
					<span>${currentFileType}</span>
				</span>
			</div>
			<div class="file-list">
				${fileButtons}
			</div>
			
			<script>
				(function() {
					const vscode = acquireVsCodeApi();
					
					document.querySelectorAll('.file-button').forEach(button => {
						button.addEventListener('click', () => {
							const filePath = button.getAttribute('data-path');
							vscode.postMessage({
								command: 'switchToFile',
								filePath: filePath
							});
						});
					});
				})();
			</script>
		</body>
		</html>`;
    }
}
