# LWC File Switcher

A Visual Studio Code extension to quickly switch between files of a Lightning Web Component (LWC).

## Features

- Quickly navigate between HTML, JS, CSS, and configuration files of a Lightning Web Component
- View and access component files from Explorer sidebar panel
- Includes support for all LWC file types (HTML, JS, CSS, configuration, tests, SVG)

## Demo

Check out how easy it is to use:

### Quick File Switching
![Switch between component files with a click](https://raw.githubusercontent.com/manantrimbakey/lwc-file-switcher/main/docs/quick-switch-shortcut.gif)
*Click through the LWC Component Files panel to quickly access any file in your component*

![Press Alt+O to switch instantly](https://raw.githubusercontent.com/manantrimbakey/lwc-file-switcher/main/docs/quick-switch.gif)
*Use the Alt+O shortcut to instantly jump between component files without taking your hands off the keyboard*

## How to Use

### Keyboard Shortcuts
- `Alt+O` (Windows/Linux) or `Option+O` (Mac): Switch between component files

### Other Access Methods
- **Explorer Panel**: View all related files in the LWC Component Files panel
- **Status Bar**: Click "LWC: componentName" in the status bar
- **Code Lens**: Click file links at the top of the file
- **Context Menu**: Right-click in editor and select "LWC: Switch Component File"
- **Command Palette**: Use `Ctrl+Shift+P` or `Cmd+Shift+P` and search for "LWC: Switch Component File"

### Toggle Explorer Panel
- Open Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`)
- Search for "LWC: Toggle Component Files Panel"

## Requirements

- Visual Studio Code version 1.98.0 or higher

## Extension Settings

- `lwcFileSwitcher.enableCodeLens`: Enable/disable code lens (default: true)
- `lwcFileSwitcher.enableStatusBar`: Enable/disable status bar item (default: true)
- `lwcFileSwitcher.enableStickyHeader`: Enable/disable Explorer panel (default: true)

## Known Issues

- None currently, but if you find any, please open an issue on repo.

**Enjoy!**