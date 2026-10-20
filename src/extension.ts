/**
 * DiffWise - AI Code Diff Reviewer
 * Main extension entry point - Full featured with auto file watcher
 */

import * as vscode from 'vscode';
import { registerCommands } from './commands/registerCommands';
import { DiffReviewPanel } from './sidebar/DiffReviewPanel';
import { diffStore } from './core/DiffStore';

let fileWatcherEnabled = false;
let watcherStatusBar: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext): void {
  console.log('DiffWise activated');

  // Register commands
  registerCommands(context);

  // Register sidebar webview
  const sidebarProvider = DiffReviewPanel.createSidebarView(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('diffwise.sidebar', sidebarProvider)
  );

  // Status bar - main
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.text = '$(diff) DiffWise';
  statusBarItem.tooltip = 'Open DiffWise Review Panel';
  statusBarItem.command = 'diffwise.openPanel';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Status bar - watcher toggle
  watcherStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
  watcherStatusBar.text = '$(eye) Auto';
  watcherStatusBar.tooltip = 'DiffWise: Auto-detect is OFF. Click to enable.';
  watcherStatusBar.command = 'diffwise.toggleWatcher';
  watcherStatusBar.show();
  context.subscriptions.push(watcherStatusBar);

  // Restore watcher state
  const savedState = context.globalState.get<boolean>('diffwise.watcherEnabled');
  if (savedState) {
    enableWatcher(context);
  }

  // Update status bar on changes
  diffStore.onChange(() => {
    const stats = diffStore.getStats();
    if (stats.pending > 0) {
      statusBarItem.text = `$(diff) DiffWise: ${stats.pending} pending`;
      statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    } else if (stats.totalFiles > 0) {
      statusBarItem.text = `$(check) DiffWise: ${stats.progressPercent}%`;
      statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
    } else {
      statusBarItem.text = '$(diff) DiffWise';
      statusBarItem.backgroundColor = undefined;
    }
  });

  // Welcome message
  const hasShownWelcome = context.globalState.get('diffwise.welcomeShown');
  if (!hasShownWelcome) {
    vscode.window.showInformationMessage(
      'DiffWise activated! Use Ctrl+Shift+D to open the panel. Click "Auto" in status bar to enable file watcher.',
      'Open Panel', 'Got it'
    ).then(selection => {
      if (selection === 'Open Panel') {
        vscode.commands.executeCommand('diffwise.sidebar.focus');
      }
    });
    context.globalState.update('diffwise.welcomeShown', true);
  }

  // Keyboard shortcut: Ctrl+Shift+D to open panel
  context.subscriptions.push(
    vscode.commands.registerCommand('diffwise.openPanelShortcut', () => {
      vscode.commands.executeCommand('diffwise.sidebar.focus');
    })
  );

  // Toggle watcher command
  context.subscriptions.push(
    vscode.commands.registerCommand('diffwise.toggleWatcher', () => {
      if (fileWatcherEnabled) {
        disableWatcher(context);
      } else {
        enableWatcher(context);
      }
    })
  );
}

function enableWatcher(context: vscode.ExtensionContext): void {
  if (fileWatcherEnabled) return;
  fileWatcherEnabled = true;

  watcherStatusBar.text = '$(eye) Auto ✓';
  watcherStatusBar.tooltip = 'DiffWise: Auto-detect is ON. Click to disable.';

  // Listen for file saves
  const disposable = vscode.workspace.onDidSaveTextDocument(async (document: vscode.TextDocument) => {
    const filePath = document.uri.fsPath;
    console.log(`DiffWise: File saved - ${filePath}`);

    // Check if workspace has git
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) return;

    // Only track files within workspace
    if (!filePath.startsWith(workspaceRoot)) return;

    // Skip non-code files
    const skipExtensions = ['.json', '.lock', '.vsix', '.png', '.jpg', '.gif', '.svg', '.ico', '.map'];
    const ext = filePath.substring(filePath.lastIndexOf('.'));
    if (skipExtensions.includes(ext)) return;

    try {
      const files = await diffStore.importFileGitDiff(filePath);
      if (files.length > 0) {
        const additions = files.reduce((s, f) => s + f.stats.additions, 0);
        const deletions = files.reduce((s, f) => s + f.stats.deletions, 0);
        vscode.window.showInformationMessage(
          `DiffWise: Detected changes in ${files.length} file(s) (+${additions} -${deletions})`,
          'View'
        ).then(selection => {
          if (selection === 'View') {
            vscode.commands.executeCommand('diffwise.sidebar.focus');
          }
        });
      }
    } catch {
      // File may not be tracked by git
    }
  });

  context.subscriptions.push(disposable);
  context.globalState.update('diffwise.watcherEnabled', true);
}

function disableWatcher(context: vscode.ExtensionContext): void {
  fileWatcherEnabled = false;

  watcherStatusBar.text = '$(eye) Auto';
  watcherStatusBar.tooltip = 'DiffWise: Auto-detect is OFF. Click to enable.';

  context.globalState.update('diffwise.watcherEnabled', false);
}

export function deactivate(): void {
  diffStore.clearAll();
}
