/**
 * Command handlers - ALL features
 */

import * as vscode from 'vscode';
import { diffStore } from '../core/DiffStore';

export function registerCommands(context: vscode.ExtensionContext): void {

  // ===== Core =====
  context.subscriptions.push(vscode.commands.registerCommand('diffwise.openPanel', () => {
    vscode.commands.executeCommand('diffwise.sidebar.focus');
  }));

  context.subscriptions.push(vscode.commands.registerCommand('diffwise.refresh', () => {
    vscode.window.showInformationMessage('DiffWise: Refreshed');
  }));

  // ===== Accept / Reject =====
  context.subscriptions.push(vscode.commands.registerCommand('diffwise.acceptAll', () => {
    const accepted = diffStore.acceptAll();
    vscode.window.showInformationMessage(`DiffWise: Accepted ${accepted.length} file(s)`);
  }));

  context.subscriptions.push(vscode.commands.registerCommand('diffwise.rejectAll', () => {
    const rejected = diffStore.rejectAll();
    vscode.window.showInformationMessage(`DiffWise: Rejected ${rejected.length} file(s)`);
  }));

  // ===== Apply / Revert =====
  context.subscriptions.push(vscode.commands.registerCommand('diffwise.applyChanges', async () => {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) { vscode.window.showErrorMessage('DiffWise: No workspace open'); return; }
    const result = await diffStore.applyAcceptedChanges(workspaceFolders[0].uri.fsPath);
    if (result.errors.length > 0) {
      vscode.window.showWarningMessage(`DiffWise: Applied ${result.applied}, ${result.errors.length} error(s)`);
    } else {
      vscode.window.showInformationMessage(`DiffWise: Applied ${result.applied} file(s) to disk`);
    }
  }));

  context.subscriptions.push(vscode.commands.registerCommand('diffwise.revertRejected', async () => {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) { vscode.window.showErrorMessage('DiffWise: No workspace open'); return; }
    const result = await diffStore.revertRejectedFiles(workspaceFolders[0].uri.fsPath);
    vscode.window.showInformationMessage(`DiffWise: Reverted ${result.reverted} file(s)`);
  }));

  // ===== Undo / Redo =====
  context.subscriptions.push(vscode.commands.registerCommand('diffwise.undo', () => {
    if (diffStore.undo()) vscode.window.showInformationMessage('DiffWise: Undone');
    else vscode.window.showInformationMessage('DiffWise: Nothing to undo');
  }));

  context.subscriptions.push(vscode.commands.registerCommand('diffwise.redo', () => {
    if (diffStore.redo()) vscode.window.showInformationMessage('DiffWise: Redone');
    else vscode.window.showInformationMessage('DiffWise: Nothing to redo');
  }));

  // ===== Import =====
  context.subscriptions.push(vscode.commands.registerCommand('diffwise.importFromClipboard', async () => {
    try {
      const text = await vscode.env.clipboard.readText();
      if (text && text.trim()) {
        const files = diffStore.addFilesToActiveSession(text, 'clipboard');
        vscode.window.showInformationMessage(`DiffWise: Imported ${files.length} file(s)`);
      } else {
        vscode.window.showWarningMessage('DiffWise: Clipboard empty');
      }
    } catch { vscode.window.showErrorMessage('DiffWise: Clipboard read failed'); }
  }));

  context.subscriptions.push(vscode.commands.registerCommand('diffwise.importFromFile', async () => {
    const uri = await vscode.window.showOpenDialog({
      canSelectMany: false,
      filters: { 'Diff Files': ['diff', 'patch', 'txt'] },
      openLabel: 'Import Diff',
    });
    if (uri && uri[0]) {
      const bytes = await vscode.workspace.fs.readFile(uri[0]);
      const text = Buffer.from(bytes).toString('utf8');
      const files = diffStore.addFilesToActiveSession(text, 'file');
      vscode.window.showInformationMessage(`DiffWise: Imported ${files.length} file(s)`);
    }
  }));

  context.subscriptions.push(vscode.commands.registerCommand('diffwise.importSelection', () => {
    const editor = vscode.window.activeTextEditor;
    if (editor && !editor.selection.isEmpty) {
      const text = editor.document.getText(editor.selection);
      if (text.trim()) {
        const files = diffStore.addFilesToActiveSession(text, 'manual');
        vscode.window.showInformationMessage(`DiffWise: Imported ${files.length} file(s)`);
      }
    } else {
      vscode.window.showWarningMessage('DiffWise: No text selected');
    }
  }));

  // ===== Git Import =====
  context.subscriptions.push(vscode.commands.registerCommand('diffwise.importGitDiff', async () => {
    vscode.window.showInformationMessage('DiffWise: Importing git diff...');
    const files = await diffStore.importGitDiff();
    vscode.window.showInformationMessage(`DiffWise: Imported ${files.length} file(s) from git diff`);
  }));

  context.subscriptions.push(vscode.commands.registerCommand('diffwise.importFullGitDiff', async () => {
    vscode.window.showInformationMessage('DiffWise: Importing full git diff (staged + unstaged)...');
    const files = await diffStore.importFullGitDiff();
    if (files.length > 0) {
      vscode.window.showInformationMessage(`DiffWise: Imported ${files.length} file(s) from full git diff`);
    } else {
      vscode.window.showInformationMessage('DiffWise: No changes found');
    }
  }));

  // ===== Export =====
  context.subscriptions.push(vscode.commands.registerCommand('diffwise.exportPatch', async () => {
    const session = diffStore.getActiveSession();
    if (!session || session.files.length === 0) {
      vscode.window.showWarningMessage('DiffWise: No diffs to export');
      return;
    }
    const { DiffParser } = require('../core/DiffParser');
    const patchContent = session.files.map((f: any) => DiffParser.toUnifiedDiff(f)).join('\n\n');

    // Show save dialog to let user choose file path
    const defaultUri = vscode.workspace.workspaceFolders?.[0]?.uri;
    const fileUri = await vscode.window.showSaveDialog({
      defaultUri: defaultUri ? vscode.Uri.joinPath(defaultUri, 'diffwise-export.patch') : undefined,
      filters: { 'Patch Files': ['patch', 'diff', 'txt'], 'All Files': ['*'] },
      title: 'Export DiffWise Patch',
      saveLabel: 'Export'
    });

    if (fileUri) {
      const fs = require('fs');
      fs.writeFileSync(fileUri.fsPath, patchContent, 'utf-8');
      vscode.window.showInformationMessage(`DiffWise: Patch exported to ${fileUri.fsPath}`);
    } else {
      // Fallback: copy to clipboard if user cancels save dialog
      await vscode.env.clipboard.writeText(patchContent);
      vscode.window.showInformationMessage('DiffWise: Patch copied to clipboard (export cancelled)');
    }
  }));

  // ===== Search =====
  context.subscriptions.push(vscode.commands.registerCommand('diffwise.search', async () => {
    const query = await vscode.window.showInputBox({ prompt: 'Search in diffs', placeHolder: 'Enter search term' });
    if (query) {
      const results = diffStore.searchInDiffs(query);
      vscode.window.showInformationMessage(`DiffWise: Found ${results.length} match(es)`);
    }
  }));

  // ===== Sort / Filter =====
  context.subscriptions.push(vscode.commands.registerCommand('diffwise.sortBy', async () => {
    const sort = await vscode.window.showQuickPick(
      ['path', 'risk', 'size', 'status', 'language'],
      { placeHolder: 'Sort by...' }
    );
    if (sort) { diffStore.setSortBy(sort as any); vscode.window.showInformationMessage(`DiffWise: Sorted by ${sort}`); }
  }));

  context.subscriptions.push(vscode.commands.registerCommand('diffwise.filterByRisk', async () => {
    const risk = await vscode.window.showQuickPick(['all', 'low', 'medium', 'high', 'critical'], { placeHolder: 'Filter by risk' });
    if (risk) { diffStore.setFilterRisk(risk as any); }
  }));

  context.subscriptions.push(vscode.commands.registerCommand('diffwise.filterByStatus', async () => {
    const status = await vscode.window.showQuickPick(['all', 'pending', 'accepted', 'rejected', 'partial', 'conflict'], { placeHolder: 'Filter by status' });
    if (status) { diffStore.setFilterStatus(status as any); }
  }));

  // ===== Batch =====
  context.subscriptions.push(vscode.commands.registerCommand('diffwise.selectAll', () => {
    diffStore.selectAll();
    vscode.window.showInformationMessage('DiffWise: All files selected');
  }));

  context.subscriptions.push(vscode.commands.registerCommand('diffwise.deselectAll', () => {
    diffStore.deselectAll();
    vscode.window.showInformationMessage('DiffWise: All files deselected');
  }));

  context.subscriptions.push(vscode.commands.registerCommand('diffwise.batchAccept', () => {
    const count = diffStore.batchAccept();
    vscode.window.showInformationMessage(`DiffWise: Accepted ${count} selected file(s)`);
  }));

  context.subscriptions.push(vscode.commands.registerCommand('diffwise.batchReject', () => {
    const count = diffStore.batchReject();
    vscode.window.showInformationMessage(`DiffWise: Rejected ${count} selected file(s)`);
  }));

  // ===== Comments =====
  context.subscriptions.push(vscode.commands.registerCommand('diffwise.addComment', async () => {
    const text = await vscode.window.showInputBox({ prompt: 'Add comment', placeHolder: 'Enter your comment' });
    if (text) {
      const session = diffStore.getActiveSession();
      if (session && session.files.length > 0) {
        diffStore.addComment(session.files[0].id, undefined, text);
        vscode.window.showInformationMessage('DiffWise: Comment added');
      }
    }
  }));

  // ===== Auto-Detect =====
  context.subscriptions.push(vscode.commands.registerCommand('diffwise.configureAutoDetect', async () => {
    const enabled = await vscode.window.showQuickPick(['yes', 'no'], { placeHolder: 'Enable auto-detect?' });
    if (enabled === 'yes') {
      const clinePath = await vscode.window.showInputBox({ prompt: 'Cline diffs folder path', placeHolder: '/path/to/cline/diffs' });
      const continuePath = await vscode.window.showInputBox({ prompt: 'Continue diffs folder path', placeHolder: '/path/to/continue/diffs' });
      diffStore.setAutoDetectConfig({
        enabled: true,
        clinePath: clinePath || '',
        continuePath: continuePath || '',
        autoImport: true,
        pollInterval: 5000,
      });
      vscode.window.showInformationMessage('DiffWise: Auto-detect enabled');
    } else {
      diffStore.setAutoDetectConfig({ enabled: false, clinePath: '', continuePath: '', autoImport: false, pollInterval: 5000 });
      vscode.window.showInformationMessage('DiffWise: Auto-detect disabled');
    }
  }));

  // ===== Statistics =====
  context.subscriptions.push(vscode.commands.registerCommand('diffwise.showStats', () => {
    const stats = diffStore.getStats();
    const message = [
      `📊 DiffWise Statistics`,
      ``,
      `Files: ${stats.totalFiles} total`,
      `  ✅ Accepted: ${stats.accepted}`,
      `  ❌ Rejected: ${stats.rejected}`,
      `  ⏳ Pending: ${stats.pending}`,
      `  ⚠️ Partial: ${stats.partial}`,
      `  🔀 Conflicts: ${stats.conflicts}`,
      ``,
      `Lines: +${stats.additions} -${stats.deletions}`,
      `Progress: ${stats.progressPercent}%`,
      `Avg Risk: ${stats.avgRiskScore}/4`,
      ``,
      `Top Languages:`,
      ...stats.topLanguages.map(l => `  ${l.name}: ${l.count}`),
      ``,
      `Top Folders:`,
      ...stats.topFolders.slice(0, 3).map(f => `  ${f.name}: ${f.count}`),
    ].join('\n');
    vscode.window.showInformationMessage(message);
  }));

  // ===== Clear =====
  context.subscriptions.push(vscode.commands.registerCommand('diffwise.clearAll', () => {
    diffStore.clearAll();
    vscode.window.showInformationMessage('DiffWise: Cleared');
  }));
}
