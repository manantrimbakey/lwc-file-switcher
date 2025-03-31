// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as path from "path";

// Import utility functions
import { 
    isLwcFile, 
    getFilesInDirectory, 
    filterComponentFiles,
    getFileTypeDescription,
    getFilePriority,
    LWC_EXTENSIONS,
    getFileTypeColor,
    getFileTypeClass
} from "./utils/fileUtils";

// Import providers
import { LwcFileListProvider } from "./providers/LwcFileListProvider";
import { LwcFileSwitcherCodeLensProvider } from "./providers/LwcCodeLensProvider";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    console.log('Extension "lwc-file-switcher" is now active!');

    // Create context key for panel visibility
    const showPanelKey = "lwcFileSwitcher.showPanel";

    // Initialize the panel visibility state based on settings
    const initialConfig = vscode.workspace.getConfiguration("lwcFileSwitcher");
    const isEnabled = initialConfig.get("enableStickyHeader", true);
    vscode.commands.executeCommand("setContext", showPanelKey, isEnabled);

    // Create status bar item for the bottom status bar
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = "lwc-file-switcher.switchFile";
    statusBarItem.tooltip = "Switch to another LWC component file";
    context.subscriptions.push(statusBarItem);

    // Register the file switcher view provider
    const fileListProvider = new LwcFileListProvider(context.extensionUri);
    const view = vscode.window.registerWebviewViewProvider("lwcFileSwitcher.fileListView", fileListProvider, {
        webviewOptions: { 
            retainContextWhenHidden: true
        },
    });
    context.subscriptions.push(view);

    // Register the command to switch between LWC component files
    const switcherCommand = vscode.commands.registerCommand("lwc-file-switcher.switchFile", async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showInformationMessage("No active editor found");
            return;
        }

        const currentFilePath = editor.document.uri.fsPath;
        const directory = path.dirname(currentFilePath);
        const baseName = path.basename(currentFilePath);
        const extName = path.extname(currentFilePath);

        // Extract the component name (everything before the first dot)
        const componentName = baseName.split(".")[0];

        // Get all files in the current directory
        const files = await getFilesInDirectory(directory);

        // Filter files that belong to this component
        const componentFiles = filterComponentFiles(files, componentName, currentFilePath);

        if (componentFiles.length === 0) {
            vscode.window.showInformationMessage("No other component files found");
            return;
        }

        // Create labels for the quick pick and sort files by priority
        const fileQuickPickItems = componentFiles
            .map((file) => {
                const fileName = path.basename(file);
                return {
                    label: fileName,
                    description: getFileTypeDescription(fileName, file),
                    filePath: file,
                    priority: getFilePriority(fileName, file)
                };
            })
            .sort((a, b) => a.priority - b.priority); // Sort by priority

        // Show the quick pick
        const selectedFile = await vscode.window.showQuickPick(fileQuickPickItems, {
            placeHolder: "Select a component file to open",
        });

        if (selectedFile) {
            const document = await vscode.workspace.openTextDocument(selectedFile.filePath);
            await vscode.window.showTextDocument(document);
        }
    });

    // Register a command to switch to a specific component file
    const switchToFileCommand = vscode.commands.registerCommand(
        "lwc-file-switcher.switchToFile",
        async (filePath: string) => {
            if (filePath) {
                const document = await vscode.workspace.openTextDocument(filePath);
                await vscode.window.showTextDocument(document);
            }
        },
    );

    // Register the editor context menu command
    const editorContextCommand = vscode.commands.registerTextEditorCommand(
        "lwc-file-switcher.switchFileContext",
        async (editor) => {
            // Re-use the same implementation
            await vscode.commands.executeCommand("lwc-file-switcher.switchFile");
        },
    );

    // Register the code lens provider
    const codeLensProvider = new LwcFileSwitcherCodeLensProvider();
    const codeLensProviderDisposable = vscode.languages.registerCodeLensProvider(
        [
            { language: "html", scheme: "file" },
            { language: "javascript", scheme: "file" },
            { language: "css", scheme: "file" },
            { language: "xml", scheme: "file" },
        ],
        codeLensProvider,
    );

    // Register the toggle command for the panel
    const toggleViewCommand = vscode.commands.registerCommand("lwc-file-switcher.toggleStickyHeader", () => {
        const config = vscode.workspace.getConfiguration("lwcFileSwitcher");
        const isEnabled = !config.get("enableStickyHeader", true);
        config.update("enableStickyHeader", isEnabled, vscode.ConfigurationTarget.Global);

        // Set the context key to control panel visibility
        vscode.commands.executeCommand("setContext", showPanelKey, isEnabled);

        vscode.window.showInformationMessage(`LWC Component Files panel ${isEnabled ? "enabled" : "disabled"}`);
    });

    // Listen for configuration changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration("lwcFileSwitcher.enableCodeLens")) {
                // Trigger a refresh of the code lenses
                vscode.commands.executeCommand("editor.action.triggerCodeLensRefresh");
            }

            if (e.affectsConfiguration("lwcFileSwitcher.enableStatusBar")) {
                updateStatusBarItem(vscode.window.activeTextEditor);
            }

            if (e.affectsConfiguration("lwcFileSwitcher.enableStickyHeader")) {
                const isEnabled = vscode.workspace.getConfiguration("lwcFileSwitcher").get("enableStickyHeader", true);

                // Set the context key to control panel visibility
                vscode.commands.executeCommand("setContext", showPanelKey, isEnabled);

                // Focus the view if it's now enabled
                if (isEnabled) {
                    setTimeout(() => {
                        vscode.commands.executeCommand("lwcFileSwitcher.fileListView.focus");
                    }, 500);
                }
            }
        }),
    );

    // Update status bar item when the active editor changes
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(async (editor) => {
            updateStatusBarItem(editor);

            // Update file list in the webview
            if (editor) {
                await fileListProvider.updateFileList(editor);
            }
        }),
    );

    // Update when the document is saved (in case of new files)
    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument(async (document) => {
            if (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document === document) {
                updateStatusBarItem(vscode.window.activeTextEditor);

                // Update file list in the webview
                await fileListProvider.updateFileList(vscode.window.activeTextEditor);
            }
        }),
    );

    // Update when any document is changed (to reflect unsaved state)
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(async (event) => {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                // Only update UI if the active editor document is an LWC file
                if (isLwcFile(editor.document.uri.fsPath)) {
                    await fileListProvider.updateFileList(editor);
                }
            }
        }),
    );

    // Listen for tab close events
    context.subscriptions.push(
        vscode.workspace.onDidCloseTextDocument(async (document: vscode.TextDocument) => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                // If no active editor, update the webview to show no component
                await fileListProvider.updateFileList(undefined);
            } else if (isLwcFile(editor.document.uri.fsPath)) {
                // If the new active editor is an LWC file, update the webview
                await fileListProvider.updateFileList(editor);
            }
        }),
    );

    // Initial update of status bar item
    updateStatusBarItem(vscode.window.activeTextEditor);

    // Show the view initially if it's enabled
    if (isEnabled) {
        // The view will be updated when it becomes visible
        setTimeout(() => {
            vscode.commands.executeCommand("lwcFileSwitcher.fileListView.focus");
            // Ensure the view is visible
            vscode.commands.executeCommand("workbench.view.explorer");
        }, 1000);
    }

    context.subscriptions.push(
        switcherCommand,
        switchToFileCommand,
        editorContextCommand,
        codeLensProviderDisposable,
        toggleViewCommand,
    );

    /**
     * Updates the status bar item based on the current editor
     */
    async function updateStatusBarItem(editor: vscode.TextEditor | undefined) {
        // Check if status bar is enabled
        const config = vscode.workspace.getConfiguration("lwcFileSwitcher");
        if (!config.get("enableStatusBar", true)) {
            statusBarItem.hide();
            return;
        }

        if (!editor) {
            statusBarItem.hide();
            return;
        }

        const filePath = editor.document.uri.fsPath;

        // Only show for LWC file types
        if (!isLwcFile(filePath)) {
            statusBarItem.hide();
            return;
        }

        const baseName = path.basename(filePath);
        const componentName = baseName.endsWith(".js-meta.xml")
            ? baseName.replace(".js-meta.xml", "") // Handle XML config files
            : baseName.split(".")[0]; // Handle other files

        // Get all files in the current directory
        const directory = path.dirname(filePath);
        const files = await getFilesInDirectory(directory);

        // Filter files that belong to this component
        const componentFiles = filterComponentFiles(files, componentName, filePath);

        if (componentFiles.length === 0) {
            statusBarItem.hide();
            return;
        }

        // Show the status bar item
        statusBarItem.text = `$(files) LWC: ${componentName} (${componentFiles.length})`;
        statusBarItem.show();
    }
}

// This method is called when your extension is deactivated
export function deactivate() {}
