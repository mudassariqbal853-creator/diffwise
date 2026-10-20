/**
 * DiffReviewPanel - Clean rewrite with ALL fixes
 */

import * as vscode from 'vscode';
import { diffStore } from '../core/DiffStore';

export class DiffReviewPanel {

  public static createSidebarView(context: vscode.ExtensionContext): vscode.WebviewViewProvider {
    return {
      resolveWebviewView(webviewView: vscode.WebviewView) {
        webviewView.webview.options = { enableScripts: true, localResourceRoots: [context.extensionUri] };
        webviewView.webview.html = DiffReviewPanel._getHtml();

        webviewView.webview.onDidReceiveMessage(
          (message) => DiffReviewPanel._handleMessage(message, webviewView),
          null,
          context.subscriptions
        );

        diffStore.onChange(() => {
          const session = diffStore.getActiveSession();
          const files = diffStore.getSortedFilteredFiles();
          const stats = diffStore.getStats();
          webviewView.webview.postMessage({ type: 'update', files, stats, session });
        });

        const session = diffStore.getActiveSession();
        const files = diffStore.getSortedFilteredFiles();
        const stats = diffStore.getStats();
        webviewView.webview.postMessage({ type: 'update', files, stats, session });
      },
    };
  }

  private static _handleMessage(message: any, webviewView: vscode.WebviewView): void {
    switch (message.type) {
      case 'acceptFile': {
        const result = diffStore.acceptFile(message.fileId);
        if (result) webviewView.webview.postMessage({ type: 'toast', text: 'Accepted: ' + result.newPath, level: 'success' });
        break;
      }
      case 'rejectFile': {
        const result = diffStore.rejectFile(message.fileId);
        if (result) webviewView.webview.postMessage({ type: 'toast', text: 'Rejected: ' + result.newPath, level: 'warning' });
        break;
      }
      case 'acceptHunk': {
        const result = diffStore.acceptHunk(message.fileId, message.hunkId);
        if (result) webviewView.webview.postMessage({ type: 'toast', text: 'Hunk accepted', level: 'success' });
        break;
      }
      case 'rejectHunk': {
        const result = diffStore.rejectHunk(message.fileId, message.hunkId);
        if (result) webviewView.webview.postMessage({ type: 'toast', text: 'Hunk rejected', level: 'warning' });
        break;
      }
      case 'toggleLine': diffStore.toggleLine(message.fileId, message.hunkId, message.lineIndex); break;
      case 'acceptAll': {
        const accepted = diffStore.acceptAll();
        webviewView.webview.postMessage({ type: 'toast', text: 'Accepted ' + accepted.length + ' file(s)', level: 'success' });
        break;
      }
      case 'rejectAll': {
        const rejected = diffStore.rejectAll();
        webviewView.webview.postMessage({ type: 'toast', text: 'Rejected ' + rejected.length + ' file(s)', level: 'warning' });
        break;
      }
      case 'undo': {
        const ok = diffStore.undo();
        webviewView.webview.postMessage({ type: 'toast', text: ok ? 'Undone' : 'Nothing to undo', level: 'info' });
        break;
      }
      case 'redo': {
        const ok = diffStore.redo();
        webviewView.webview.postMessage({ type: 'toast', text: ok ? 'Redone' : 'Nothing to redo', level: 'info' });
        break;
      }
      case 'applyChanges': vscode.commands.executeCommand('diffwise.applyChanges'); break;
      case 'importClipboard': vscode.commands.executeCommand('diffwise.importFromClipboard'); break;
      case 'importGitDiff': vscode.commands.executeCommand('diffwise.importGitDiff'); break;
      case 'importFullGitDiff': vscode.commands.executeCommand('diffwise.importFullGitDiff'); break;
      case 'exportPatch': vscode.commands.executeCommand('diffwise.exportPatch'); break;
      case 'showStats': vscode.commands.executeCommand('diffwise.showStats'); break;
      case 'configureAutoDetect': vscode.commands.executeCommand('diffwise.configureAutoDetect'); break;
      case 'selectAll': diffStore.selectAll(); break;
      case 'deselectAll': diffStore.deselectAll(); break;
      case 'batchAccept': { const c = diffStore.batchAccept(); webviewView.webview.postMessage({ type: 'toast', text: 'Accepted ' + c + ' selected', level: 'success' }); break; }
      case 'batchReject': { const c = diffStore.batchReject(); webviewView.webview.postMessage({ type: 'toast', text: 'Rejected ' + c + ' selected', level: 'warning' }); break; }
      case 'selectFile': diffStore.selectFile(message.fileId, message.selected); break;
      case 'setFilter': diffStore.setFilterStatus(message.filter); break;
      case 'setRiskFilter': diffStore.setFilterRisk(message.filter); break;
      case 'setSort': diffStore.setSortBy(message.sort); break;
      case 'setSearch': diffStore.setSearchQuery(message.query); break;
      case 'setGroupByFolder': diffStore.setGroupByFolder(message.group); break;
      case 'addComment':
        vscode.window.showInputBox({ prompt: 'Add comment' }).then(text => {
          if (text) diffStore.addComment(message.fileId, message.hunkId, text);
        });
        break;
      case 'resolveComment': diffStore.resolveComment(message.fileId, message.commentId); break;
      case 'openFile':
        const ws = vscode.workspace.workspaceFolders?.[0];
        if (ws) vscode.commands.executeCommand('vscode.open', vscode.Uri.joinPath(ws.uri, message.filePath));
        break;
      case 'importFromFile': vscode.commands.executeCommand('diffwise.importFromFile'); break;
    }
  }

  private static _getHtml(): string {
    const nonce = getNonce();
    const csp = "default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-" + nonce + "';";

    return '<!DOCTYPE html>\n<html lang="en"><head>\n' +
      '<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">\n' +
      '<meta http-equiv="Content-Security-Policy" content="' + csp + '">\n' +
      '<title>DiffWise</title>\n' +
      '<style>\n' + CSS + '\n</style>\n</head><body>\n' + HTML + '\n' +
      '<script nonce="' + nonce + '">\n' + JS + '\n</script>\n</body></html>';
  }
}

function getNonce(): string {
  let t = '';
  const p = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) t += p.charAt(Math.floor(Math.random() * p.length));
  return t;
}

const CSS = `
:root {
  --bg-deep: #0a0e17; --bg-primary: #0d1117; --bg-secondary: #111827;
  --bg-card: #1a2235; --bg-card-hover: #1f2a40; --bg-input: #0f1623;
  --border: #1e2d3d; --border-light: #2a3f54;
  --text-primary: #e2e8f0; --text-secondary: #94a3b8; --text-muted: #64748b;
  --accent: #3b82f6; --accent-hover: #2563eb; --accent-glow: rgba(59,130,246,0.15);
  --success: #10b981; --success-bg: rgba(16,185,129,0.1); --success-border: rgba(16,185,129,0.3);
  --danger: #ef4444; --danger-bg: rgba(239,68,68,0.1); --danger-border: rgba(239,68,68,0.3);
  --warning: #f59e0b; --warning-bg: rgba(245,158,11,0.1); --warning-border: rgba(245,158,11,0.3);
  --purple: #8b5cf6; --purple-bg: rgba(139,92,246,0.1); --purple-border: rgba(139,92,246,0.3);
  --radius: 8px; --radius-sm: 6px;
  --shadow: 0 4px 16px rgba(0,0,0,0.3); --shadow-lg: 0 8px 32px rgba(0,0,0,0.4);
  --transition: all 0.2s ease;
  --font-mono: 'JetBrains Mono','Fira Code','Cascadia Code',Consolas,'Courier New',monospace;
  --font-sans: -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;
}
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:var(--font-sans); background:var(--bg-deep); color:var(--text-primary); font-size:13px; line-height:1.5; overflow-x:hidden; }
::-webkit-scrollbar { width:6px; height:6px; }
::-webkit-scrollbar-track { background:transparent; }
::-webkit-scrollbar-thumb { background:var(--border); border-radius:3px; }
::-webkit-scrollbar-thumb:hover { background:var(--border-light); }

.brand-header { display:flex; align-items:center; justify-content:space-between; padding:12px 16px; background:var(--bg-secondary); border-bottom:1px solid var(--border); }
.brand-left { display:flex; align-items:center; gap:10px; }
.brand-icon { width:36px; height:36px; background:linear-gradient(135deg,var(--accent),#6366f1); border-radius:var(--radius); display:flex; align-items:center; justify-content:center; overflow:hidden; }
.brand-icon img { width:24px; height:24px; object-fit:contain; }
.brand-info h1 { font-size:15px; font-weight:700; color:var(--text-primary); display:flex; align-items:center; gap:6px; }
.brand-info h1 .ai-badge { background:linear-gradient(135deg,#6366f1,#8b5cf6); color:#fff; font-size:9px; font-weight:700; padding:2px 6px; border-radius:10px; letter-spacing:0.5px; }
.brand-subtitle { font-size:11px; color:var(--text-muted); margin-top:1px; }
.brand-right { display:flex; align-items:center; gap:8px; }
.review-status { display:flex; align-items:center; gap:6px; padding:6px 12px; background:var(--success-bg); border:1px solid var(--success-border); border-radius:20px; font-size:11px; font-weight:600; color:var(--success); cursor:pointer; transition:var(--transition); }
.review-status:hover { background:rgba(16,185,129,0.15); }
.review-status .dot { width:6px; height:6px; background:var(--success); border-radius:50%; }
.header-actions { display:flex; gap:4px; }
.header-btn { width:32px; height:32px; border:none; background:transparent; color:var(--text-muted); border-radius:var(--radius-sm); cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:14px; transition:var(--transition); }
.header-btn:hover { background:var(--bg-card); color:var(--text-primary); }

.progress-section { padding:12px 16px; background:var(--bg-primary); border-bottom:1px solid var(--border); }
.progress-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; }
.progress-label { font-size:10px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px; }
.progress-value { font-size:12px; font-weight:700; color:var(--accent); }
.progress-track { height:4px; background:var(--bg-card); border-radius:2px; overflow:hidden; }
.progress-fill { height:100%; border-radius:2px; transition:width 0.5s ease; background:linear-gradient(90deg,var(--accent),#6366f1); }
.progress-fill.complete { background:linear-gradient(90deg,var(--success),#34d399); }

.metrics-grid { display:grid; grid-template-columns:repeat(8,1fr); gap:8px; padding:12px 16px; background:var(--bg-primary); border-bottom:1px solid var(--border); }
.metric-card { background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius); padding:10px 8px; text-align:center; transition:var(--transition); cursor:default; }
.metric-card:hover { border-color:var(--border-light); background:var(--bg-card-hover); transform:translateY(-1px); }
.metric-icon { font-size:18px; margin-bottom:4px; display:block; }
.metric-value { font-size:20px; font-weight:700; color:var(--text-primary); line-height:1.2; }
.metric-label { font-size:9px; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; margin-top:2px; }
.metric-card.files .metric-icon { color:var(--accent); }
.metric-card.pending .metric-icon { color:var(--warning); }
.metric-card.accepted .metric-value,.metric-card.accepted .metric-icon { color:var(--success); }
.metric-card.rejected .metric-value,.metric-card.rejected .metric-icon { color:var(--danger); }
.metric-card.added .metric-value,.metric-card.added .metric-icon { color:var(--success); }
.metric-card.removed .metric-value,.metric-card.removed .metric-icon { color:var(--danger); }
.metric-card.conflicts .metric-icon { color:var(--warning); }
.metric-card.comments .metric-icon { color:var(--purple); }

.action-toolbar { display:flex; align-items:center; gap:4px; padding:10px 16px; background:var(--bg-primary); border-bottom:1px solid var(--border); flex-wrap:wrap; }
.toolbar-group { display:flex; gap:4px; align-items:center; }
.toolbar-sep { width:1px; height:24px; background:var(--border); margin:0 6px; }
.btn { padding:7px 14px; border:1px solid var(--border); border-radius:var(--radius-sm); background:var(--bg-card); color:var(--text-primary); cursor:pointer; font-size:12px; font-family:var(--font-sans); font-weight:500; display:inline-flex; align-items:center; gap:6px; transition:var(--transition); white-space:nowrap; min-height:32px; }
.btn:hover { background:var(--bg-card-hover); border-color:var(--border-light); }
.btn:active { transform:scale(0.98); }
.btn-primary { background:var(--accent); border-color:var(--accent); color:#fff; }
.btn-primary:hover { background:var(--accent-hover); border-color:var(--accent-hover); }
.btn-success { border-color:var(--success-border); color:var(--success); background:var(--success-bg); }
.btn-success:hover { background:rgba(16,185,129,0.2); }
.btn-danger { border-color:var(--danger-border); color:var(--danger); background:var(--danger-bg); }
.btn-danger:hover { background:rgba(239,68,68,0.2); }
.btn-sm { padding:5px 10px; font-size:11px; min-height:28px; }
.btn-xs { padding:3px 8px; font-size:10px; border-radius:4px; min-height:22px; }
.btn-ghost { border-color:transparent; background:transparent; color:var(--text-muted); }
.btn-ghost:hover { background:var(--bg-card); color:var(--text-primary); }

.filter-bar { display:flex; gap:2px; padding:8px 16px; background:var(--bg-primary); border-bottom:1px solid var(--border); overflow-x:auto; }
.filter-tab { padding:5px 12px; border-radius:20px; font-size:11px; cursor:pointer; color:var(--text-muted); border:1px solid transparent; transition:var(--transition); display:flex; align-items:center; gap:5px; white-space:nowrap; font-weight:500; background:var(--bg-card); }
.filter-tab:hover { color:var(--text-primary); background:var(--bg-card-hover); }
.filter-tab.active { background:var(--accent); color:#fff; border-color:var(--accent); }
.filter-tab .count { background:rgba(255,255,255,0.15); padding:1px 6px; border-radius:10px; font-size:9px; font-weight:700; min-width:16px; text-align:center; }
.filter-tab:not(.active) .count { background:var(--bg-secondary); color:var(--text-muted); }

.controls-bar { display:flex; align-items:center; gap:8px; padding:8px 16px; background:var(--bg-primary); border-bottom:1px solid var(--border); flex-wrap:wrap; }
.search-wrap { flex:1; min-width:200px; position:relative; }
.search-input { width:100%; padding:7px 12px 7px 32px; border:1px solid var(--border); border-radius:var(--radius); background:var(--bg-input); color:var(--text-primary); font-size:12px; font-family:var(--font-sans); outline:none; transition:var(--transition); }
.search-input:focus { border-color:var(--accent); box-shadow:0 0 0 2px var(--accent-glow); }
.search-input::placeholder { color:var(--text-muted); }
.search-icon { position:absolute; left:10px; top:50%; transform:translateY(-50%); color:var(--text-muted); font-size:13px; pointer-events:none; }
.control-group { display:flex; align-items:center; gap:6px; }
.control-label { font-size:11px; color:var(--text-muted); font-weight:500; }
.control-select { padding:5px 8px; border:1px solid var(--border); border-radius:var(--radius-sm); background:var(--bg-input); color:var(--text-primary); font-size:11px; font-family:var(--font-sans); cursor:pointer; outline:none; transition:var(--transition); }
.control-select:hover { border-color:var(--border-light); }
.control-select:focus { border-color:var(--accent); }
.control-checkbox { display:flex; align-items:center; gap:5px; font-size:11px; color:var(--text-secondary); cursor:pointer; }
.control-checkbox input[type="checkbox"] { width:14px; height:14px; accent-color:var(--accent); cursor:pointer; }

.file-list { padding:4px 0; }
.folder-group { border-bottom:1px solid var(--border); }
.folder-header { display:flex; align-items:center; gap:8px; padding:8px 16px; background:var(--bg-secondary); cursor:pointer; transition:var(--transition); font-size:11px; font-weight:600; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.5px; }
.folder-header:hover { background:var(--bg-card); color:var(--text-primary); }
.folder-header .folder-icon { font-size:13px; }
.folder-header .folder-name { flex:1; }
.folder-header .folder-count { background:var(--bg-card); padding:1px 8px; border-radius:10px; font-size:10px; font-weight:600; color:var(--text-muted); }
.folder-header .folder-chevron { font-size:10px; transition:transform 0.2s; color:var(--text-muted); }
.folder-header.expanded .folder-chevron { transform:rotate(90deg); }

.file-row { border-bottom:1px solid rgba(255,255,255,0.03); transition:var(--transition); }
.file-row:hover { background:rgba(255,255,255,0.02); }
.file-row.selected { background:var(--accent-glow); }
.file-main { display:flex; align-items:center; padding:8px 16px; gap:8px; cursor:pointer; transition:var(--transition); }
.file-main:hover { background:var(--bg-card); }
.file-checkbox { width:20px; height:20px; border:1.5px solid var(--border-light); border-radius:4px; display:flex; align-items:center; justify-content:center; cursor:pointer; transition:var(--transition); flex-shrink:0; font-size:12px; font-weight:700; color:transparent; background:var(--bg-input); }
.file-checkbox:hover { border-color:var(--accent); background:var(--accent-glow); }
.file-checkbox.checked { background:var(--accent); border-color:var(--accent); color:#fff; }
.file-chevron { font-size:10px; color:var(--text-muted); transition:transform 0.2s; flex-shrink:0; width:14px; }
.file-chevron.expanded { transform:rotate(90deg); }
.file-info { flex:1; min-width:0; }
.file-path-row { display:flex; align-items:center; gap:6px; margin-bottom:3px; }
.file-path { font-family:var(--font-mono); font-size:12px; color:var(--text-primary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.file-path .folder-part { color:var(--text-muted); }
.file-path .name-part { color:var(--text-primary); font-weight:500; }
.file-badges { display:flex; align-items:center; gap:4px; flex-wrap:wrap; }
.badge { font-size:9px; padding:2px 7px; border-radius:10px; font-weight:600; text-transform:uppercase; letter-spacing:0.3px; display:inline-flex; align-items:center; gap:3px; }
.badge-new { background:var(--success-bg); color:var(--success); border:1px solid var(--success-border); }
.badge-deleted { background:var(--danger-bg); color:var(--danger); border:1px solid var(--danger-border); }
.badge-renamed { background:var(--purple-bg); color:var(--purple); border:1px solid var(--purple-border); }
.badge-risk-low { background:var(--success-bg); color:var(--success); }
.badge-risk-medium { background:var(--warning-bg); color:var(--warning); }
.badge-risk-high { background:var(--warning-bg); color:var(--warning); border:1px solid var(--warning-border); }
.badge-risk-critical { background:var(--danger-bg); color:var(--danger); border:1px solid var(--danger-border); }
.badge-lang { background:var(--accent-glow); color:var(--accent); }
.badge-status-pending { background:var(--warning-bg); color:var(--warning); }
.badge-status-accepted { background:var(--success-bg); color:var(--success); }
.badge-status-rejected { background:var(--danger-bg); color:var(--danger); }
.badge-status-partial { background:var(--warning-bg); color:var(--warning); }
.badge-status-conflict { background:var(--danger-bg); color:var(--danger); border:1px solid var(--danger-border); }
.file-stats { display:flex; align-items:center; gap:8px; flex-shrink:0; font-size:12px; font-weight:600; }
.file-stats .add { color:var(--success); }
.file-stats .del { color:var(--danger); }
.file-actions { display:flex; gap:4px; flex-shrink:0; }

.risk-panel { margin:0 16px 8px; padding:10px 12px; background:var(--danger-bg); border:1px solid var(--danger-border); border-radius:var(--radius); }
.risk-panel.high { background:var(--warning-bg); border-color:var(--warning-border); }
.risk-title { font-size:11px; font-weight:700; margin-bottom:6px; display:flex; align-items:center; gap:6px; }
.risk-panel:not(.high) .risk-title { color:var(--danger); }
.risk-panel.high .risk-title { color:var(--warning); }
.risk-reasons { list-style:none; padding:0; }
.risk-reasons li { padding:2px 0; font-size:11px; color:var(--text-secondary); display:flex; align-items:center; gap:6px; }
.risk-reasons li::before { content:'\\2022'; color:var(--text-muted); }

.diff-content { display:none; margin:0 16px 12px; border:1px solid var(--border); border-radius:var(--radius); overflow:hidden; background:var(--bg-deep); }
.diff-content.expanded { display:block; }
.hunk { border-bottom:1px solid var(--border); }
.hunk:last-child { border-bottom:none; }
.hunk-header { display:flex; align-items:center; padding:5px 12px; background:var(--bg-secondary); font-size:11px; color:var(--text-muted); gap:6px; border-bottom:1px solid var(--border); }
.hunk-code { font-family:var(--font-mono); font-size:11px; color:var(--accent); }
.hunk-actions { margin-left:auto; display:flex; gap:3px; }
.diff-line { display:flex; font-family:var(--font-mono); font-size:12px; line-height:1.6; min-height:20px; }
.diff-line:hover { background:rgba(255,255,255,0.02); }
.diff-line.added { background:var(--success-bg); }
.diff-line.added:hover { background:rgba(16,185,129,0.15); }
.diff-line.removed { background:var(--danger-bg); }
.diff-line.removed:hover { background:rgba(239,68,68,0.15); }
.diff-line.context { opacity:0.5; }
.line-check { width:24px; min-width:24px; text-align:center; cursor:pointer; font-size:11px; opacity:0.3; transition:var(--transition); display:flex; align-items:center; justify-content:center; color:var(--text-muted); }
.line-check:hover { opacity:1; }
.line-check.checked { opacity:1; color:var(--success); }
.line-num { width:36px; min-width:36px; text-align:right; padding:0 6px; color:var(--text-muted); user-select:none; font-size:11px; }
.line-num.new { border-left:1px solid var(--border); }
.line-marker { width:16px; min-width:16px; text-align:center; font-size:12px; user-select:none; font-weight:700; }
.line-marker.added { color:var(--success); }
.line-marker.removed { color:var(--danger); }
.line-content { flex:1; padding:0 8px; white-space:pre; overflow-x:auto; color:var(--text-secondary); }
.diff-line.added .line-content { color:var(--success); }
.diff-line.removed .line-content { color:var(--danger); }

.sbs-view { display:none; }
.sbs-view.active { display:flex; }
.sbs-pane { flex:1; min-width:0; }
.sbs-divider { width:2px; background:var(--border); cursor:col-resize; }

.comment-section { padding:8px 16px; background:var(--bg-secondary); border-bottom:1px solid var(--border); }
.comment { padding:6px 0; font-size:11px; display:flex; gap:8px; align-items:flex-start; }
.comment-avatar { width:22px; height:22px; border-radius:50%; background:var(--accent); color:#fff; display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:700; flex-shrink:0; }
.comment-body { flex:1; }
.comment-author { font-weight:600; font-size:10px; color:var(--text-muted); }
.comment-text { color:var(--text-primary); margin-top:2px; }
.comment-time { font-size:9px; color:var(--text-muted); margin-top:2px; }
.comment-resolved { opacity:0.5; text-decoration:line-through; }
.comment-actions { display:flex; gap:4px; margin-top:4px; }

.stats-panel { padding:12px 16px; background:var(--bg-primary); border-bottom:1px solid var(--border); }
.stats-panel h3 { font-size:12px; font-weight:700; margin-bottom:8px; color:var(--text-primary); }
.stat-row { display:flex; justify-content:space-between; padding:3px 0; font-size:11px; }
.stat-row .label { color:var(--text-muted); }
.stat-row .value { font-weight:600; color:var(--text-primary); }
.stat-bar { height:6px; background:var(--bg-card); border-radius:3px; overflow:hidden; margin-top:2px; }
.stat-bar-fill { height:100%; border-radius:3px; transition:width 0.3s; }
.lang-list { display:flex; flex-wrap:wrap; gap:4px; margin-top:6px; }
.lang-tag { padding:2px 8px; border-radius:10px; font-size:10px; background:var(--accent-glow); color:var(--accent); font-weight:500; }

.empty { text-align:center; padding:48px 20px; color:var(--text-muted); }
.empty .icon { font-size:48px; margin-bottom:16px; opacity:0.3; }
.empty h3 { font-size:14px; margin-bottom:8px; color:var(--text-primary); font-weight:600; }
.empty p { font-size:12px; margin-bottom:20px; line-height:1.5; }
.empty-actions { display:flex; gap:8px; justify-content:center; flex-wrap:wrap; }

.toast { position:fixed; bottom:20px; left:50%; transform:translateX(-50%) translateY(80px); background:var(--accent); color:#fff; padding:8px 18px; border-radius:var(--radius); font-size:12px; font-weight:500; z-index:1000; transition:transform 0.3s ease; pointer-events:none; box-shadow:var(--shadow-lg); }
.toast.show { transform:translateX(-50%) translateY(0); }
.toast.success { background:var(--success); }
.toast.error { background:var(--danger); }
.toast.warning { background:var(--warning); }

.kbd-hint { position:fixed; bottom:4px; right:10px; font-size:9px; color:var(--text-muted); opacity:0.4; }
.kbd { display:inline-block; padding:1px 4px; border:1px solid var(--border); border-radius:3px; font-family:var(--font-mono); font-size:9px; background:var(--bg-card); margin:0 2px; }

@media (max-width:600px) { .metrics-grid { grid-template-columns:repeat(4,1fr); } .file-stats { display:none; } .controls-bar { flex-direction:column; align-items:stretch; } .search-wrap { min-width:100%; } }
@media (max-width:400px) { .metrics-grid { grid-template-columns:repeat(2,1fr); } .action-toolbar { gap:2px; } .btn-sm { padding:4px 8px; font-size:10px; } }
`;

const HTML = `
<div class="brand-header">
  <div class="brand-left">
    <div class="brand-icon">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="4" width="8" height="16" rx="1" fill="#182437" stroke="#24d8f5" stroke-width="0.5"/>
        <rect x="14" y="4" width="8" height="16" rx="1" fill="#142c2e" stroke="#27e8bd" stroke-width="0.5"/>
        <circle cx="12" cy="12" r="2.5" fill="#0c121b" stroke="#1689f9" stroke-width="0.8"/>
        <path d="M10 12h4" stroke="#20e7bc" stroke-width="0.8" stroke-linecap="round"/>
        <line x1="4" y1="8" x2="8" y2="8" stroke="#ff5f69" stroke-width="0.8" stroke-linecap="round"/>
        <line x1="4" y1="11" x2="7" y2="11" stroke="#ff5f69" stroke-width="0.8" stroke-linecap="round"/>
        <line x1="4" y1="14" x2="8" y2="14" stroke="#ff5f69" stroke-width="0.8" stroke-linecap="round"/>
        <line x1="16" y1="8" x2="20" y2="8" stroke="#28efbd" stroke-width="0.8" stroke-linecap="round"/>
        <line x1="16" y1="11" x2="19" y2="11" stroke="#28efbd" stroke-width="0.8" stroke-linecap="round"/>
        <line x1="16" y1="14" x2="20" y2="14" stroke="#28efbd" stroke-width="0.8" stroke-linecap="round"/>
      </svg>
    </div>
    <div class="brand-info">
      <h1>DiffWise <span class="ai-badge">AI</span></h1>
      <div class="brand-subtitle">Smart Code Diff Reviewer</div>
    </div>
  </div>
  <div class="brand-right">
    <div class="review-status" id="reviewStatus"><span class="dot"></span><span id="reviewStatusText">No session</span></div>
    <div class="header-actions">
      <button class="header-btn" data-action="undo" title="Undo">&#8617;</button>
      <button class="header-btn" data-action="redo" title="Redo">&#8618;</button>
    </div>
  </div>
</div>

<div class="progress-section">
  <div class="progress-header"><span class="progress-label">Review Progress</span><span class="progress-value" id="progressPct">0%</span></div>
  <div class="progress-track"><div class="progress-fill" id="progressFill" style="width:0%"></div></div>
</div>

<div class="metrics-grid">
  <div class="metric-card files"><span class="metric-icon">&#128196;</span><div class="metric-value" id="sTotal">0</div><div class="metric-label">Files</div></div>
  <div class="metric-card pending"><span class="metric-icon">&#9203;</span><div class="metric-value" id="sPending">0</div><div class="metric-label">Pending</div></div>
  <div class="metric-card accepted"><span class="metric-icon">&#10003;</span><div class="metric-value" id="sAccepted">0</div><div class="metric-label">Accepted</div></div>
  <div class="metric-card rejected"><span class="metric-icon">&#10007;</span><div class="metric-value" id="sRejected">0</div><div class="metric-label">Rejected</div></div>
  <div class="metric-card added"><span class="metric-icon">+</span><div class="metric-value" id="sAdd">0</div><div class="metric-label">Added</div></div>
  <div class="metric-card removed"><span class="metric-icon">&minus;</span><div class="metric-value" id="sDel">0</div><div class="metric-label">Removed</div></div>
  <div class="metric-card conflicts"><span class="metric-icon">&#9888;</span><div class="metric-value" id="sConflict">0</div><div class="metric-label">Conflicts</div></div>
  <div class="metric-card comments"><span class="metric-icon">&#128172;</span><div class="metric-value" id="sComments">0</div><div class="metric-label">Comments</div></div>
</div>

<div class="action-toolbar">
  <div class="toolbar-group">
    <button class="btn btn-success btn-sm" data-action="acceptAll">&#10003; Accept All</button>
    <button class="btn btn-danger btn-sm" data-action="rejectAll">&#10007; Reject All</button>
    <button class="btn btn-primary btn-sm" data-action="applyChanges">&#9889; Apply</button>
  </div>
  <div class="toolbar-sep"></div>
  <div class="toolbar-group">
    <button class="btn btn-sm" data-action="importClipboard">&#128203; Clipboard</button>
    <button class="btn btn-sm" data-action="importGitDiff">&#128221; Git Diff</button>
    <button class="btn btn-sm" data-action="importFullGitDiff">&#128229; Full Diff</button>
    <button class="btn btn-sm" data-action="exportPatch">&#128228; Export</button>
  </div>
  <div class="toolbar-sep"></div>
  <div class="toolbar-group">
    <button class="btn btn-sm" data-action="selectAll" id="selectAllBtn">&#9745; Select All</button>
    <button class="btn btn-sm" data-action="batchAccept">&#10003; Accept</button>
    <button class="btn btn-sm" data-action="batchReject">&#10007; Reject</button>
  </div>
  <div class="toolbar-sep"></div>
  <div class="toolbar-group">
    <button class="btn btn-sm" data-action="expandAll">&#9660; Expand</button>
    <button class="btn btn-sm" data-action="collapseAll">&#9650; Collapse</button>
  </div>
  <div class="toolbar-sep"></div>
  <div class="toolbar-group">
    <button class="btn btn-sm" data-action="showStats">&#128202; Stats</button>
    <button class="btn btn-sm" data-action="configureAutoDetect">&#9881; Settings</button>
  </div>
</div>

<div class="filter-bar" id="filterBar">
  <div class="filter-tab active" data-filter="all">All <span class="count" id="fAll">0</span></div>
  <div class="filter-tab" data-filter="pending">Pending <span class="count" id="fPending">0</span></div>
  <div class="filter-tab" data-filter="accepted">Accepted <span class="count" id="fAccepted">0</span></div>
  <div class="filter-tab" data-filter="rejected">Rejected <span class="count" id="fRejected">0</span></div>
  <div class="filter-tab" data-filter="partial">Partial <span class="count" id="fPartial">0</span></div>
  <div class="filter-tab" data-filter="conflict">Conflicts <span class="count" id="fConflict">0</span></div>
</div>

<div class="controls-bar">
  <div class="search-wrap"><span class="search-icon">&#128269;</span><input class="search-input" id="searchInput" placeholder="Search files, content, languages..."></div>
  <div class="control-group"><span class="control-label">Sort:</span><select class="control-select" id="sortSelect"><option value="path">Path</option><option value="risk">Risk</option><option value="size">Size</option><option value="status">Status</option><option value="language">Language</option></select></div>
  <div class="control-group"><span class="control-label">Risk:</span><select class="control-select" id="riskSelect"><option value="all">All</option><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></div>
  <label class="control-checkbox"><input type="checkbox" id="sbsToggle"> Side-by-side</label>
  <label class="control-checkbox"><input type="checkbox" id="groupByFolder" checked> Group by folder</label>
</div>

<div class="stats-panel" id="statsPanel" style="display:none"><h3>&#128202; Statistics Dashboard</h3><div id="statsContent"></div></div>

<div class="file-list" id="fileList">
  <div class="empty" id="emptyState">
    <div class="icon">&#128203;</div>
    <h3>No diffs to review</h3>
    <p>Import a unified diff, git diff, or paste from clipboard<br>to start reviewing AI-generated changes.</p>
    <div class="empty-actions">
      <button class="btn btn-primary" data-action="importClipboard">&#128203; Import Clipboard</button>
      <button class="btn" data-action="importGitDiff">&#128221; Import Git Diff</button>
      <button class="btn" data-action="importFromFile">&#128193; Import File</button>
    </div>
  </div>
</div>

<div class="toast" id="toast"></div>
<div class="kbd-hint"><span class="kbd">Ctrl+A</span> Accept All <span class="kbd">Ctrl+R</span> Reject All <span class="kbd">Ctrl+Z</span> Undo <span class="kbd">Ctrl+F</span> Search</div>
`;

const JS = `
const vscode = acquireVsCodeApi();
let expandedFiles = new Set();
let currentFilter = 'all';
let searchQuery = '';
let sideBySide = false;
let groupByFolder = true;
let allFiles = [];
let statsPanelVisible = false;

// Set brand icon
var brandImg = document.getElementById('brandImg');
if (brandImg && brandImg.src) { /* already set via data URI */ }

document.addEventListener('click', function(e) {
  // 1. Checkbox first (inside file-main)
  var fileCheckbox = e.target.closest('.file-checkbox');
  if (fileCheckbox) {
    e.stopPropagation();
    var fid = fileCheckbox.getAttribute('data-file-id');
    if (fid) selectFile(fid, !fileCheckbox.classList.contains('checked'));
    return;
  }
  // 2. Line check
  var lineCheck = e.target.closest('.line-check');
  if (lineCheck && lineCheck.getAttribute('data-file-id') && lineCheck.getAttribute('data-hunk-id') && lineCheck.getAttribute('data-line-index') !== null) {
    e.stopPropagation();
    toggleLine(lineCheck.getAttribute('data-file-id'), lineCheck.getAttribute('data-hunk-id'), parseInt(lineCheck.getAttribute('data-line-index')));
    return;
  }
  // 3. data-action buttons
  var btn = e.target.closest('[data-action]');
  if (btn) { handleAction(btn.getAttribute('data-action'), btn); return; }
  // 4. Filter tabs
  var filterTab = e.target.closest('.filter-tab');
  if (filterTab) {
    currentFilter = filterTab.getAttribute('data-filter');
    var tabs = document.querySelectorAll('.filter-tab');
    for (var i = 0; i < tabs.length; i++) tabs[i].classList.remove('active');
    filterTab.classList.add('active');
    render();
    return;
  }
  // 5. Folder header
  var folderHeader = e.target.closest('.folder-header');
  if (folderHeader) { folderHeader.classList.toggle('expanded'); return; }
  // 6. File row expand/collapse
  var fileMain = e.target.closest('.file-main');
  if (fileMain) { toggleFile(fileMain.getAttribute('data-file-id')); return; }
});

document.addEventListener('change', function(e) {
  if (e.target.id === 'sortSelect') vscode.postMessage({ type: 'setSort', sort: e.target.value });
  else if (e.target.id === 'riskSelect') vscode.postMessage({ type: 'setRiskFilter', filter: e.target.value });
  else if (e.target.id === 'sbsToggle') { sideBySide = e.target.checked; render(); }
  else if (e.target.id === 'groupByFolder') { groupByFolder = e.target.checked; vscode.postMessage({ type: 'setGroupByFolder', group: groupByFolder }); render(); }
});

document.getElementById('searchInput').addEventListener('input', function(e) { searchQuery = e.target.value; render(); });

function handleAction(action, btn) {
  switch (action) {
    case 'undo': doUndo(); break;
    case 'redo': doRedo(); break;
    case 'acceptAll': acceptAll(); break;
    case 'rejectAll': rejectAll(); break;
    case 'applyChanges': applyChanges(); break;
    case 'importClipboard': importClipboard(); break;
    case 'importGitDiff': importGitDiff(); break;
    case 'importFullGitDiff': importFullGitDiff(); break;
    case 'exportPatch': exportPatch(); break;
    case 'showStats': showStatsPanel(); break;
    case 'configureAutoDetect': configureAutoDetect(); break;
    case 'selectAll': selectAll(); break;
    case 'deselectAll': deselectAll(); break;
    case 'batchAccept': batchAccept(); break;
    case 'batchReject': batchReject(); break;
    case 'expandAll': expandAll(); break;
    case 'collapseAll': collapseAll(); break;
    case 'importFromFile': importFromFile(); break;
    case 'acceptFile': if (btn.getAttribute('data-file-id')) acceptFile(btn.getAttribute('data-file-id')); break;
    case 'rejectFile': if (btn.getAttribute('data-file-id')) rejectFile(btn.getAttribute('data-file-id')); break;
    case 'acceptHunk': if (btn.getAttribute('data-file-id') && btn.getAttribute('data-hunk-id')) acceptHunk(btn.getAttribute('data-file-id'), btn.getAttribute('data-hunk-id')); break;
    case 'rejectHunk': if (btn.getAttribute('data-file-id') && btn.getAttribute('data-hunk-id')) rejectHunk(btn.getAttribute('data-file-id'), btn.getAttribute('data-hunk-id')); break;
    case 'addComment': if (btn.getAttribute('data-file-id') && btn.getAttribute('data-hunk-id')) addComment(btn.getAttribute('data-file-id'), btn.getAttribute('data-hunk-id')); break;
    case 'resolveComment': if (btn.getAttribute('data-file-id') && btn.getAttribute('data-comment-id')) resolveComment(btn.getAttribute('data-file-id'), btn.getAttribute('data-comment-id')); break;
  }
}

window.addEventListener('message', function(e) {
  var m = e.data;
  if (m.type === 'update') {
    allFiles = m.files || [];
    render();
    updateStats(m.stats);
    updateReviewStatus(m.stats);
    if (statsPanelVisible) renderStatsPanel(m.stats);
  }
  if (m.type === 'toast') showToast(m.text, m.level || 'info');
});

function updateReviewStatus(stats) {
  var statusEl = document.getElementById('reviewStatusText');
  var statusDot = document.querySelector('.review-status .dot');
  var statusContainer = document.getElementById('reviewStatus');
  if (!stats || stats.totalFiles === 0) {
    statusEl.textContent = 'No session';
    statusDot.style.background = 'var(--text-muted)';
    statusContainer.style.borderColor = 'var(--border)';
    statusContainer.style.color = 'var(--text-muted)';
  } else if (stats.progressPercent === 100) {
    statusEl.textContent = 'Review Complete';
    statusDot.style.background = 'var(--success)';
    statusContainer.style.borderColor = 'var(--success-border)';
    statusContainer.style.color = 'var(--success)';
  } else if (stats.pending > 0) {
    statusEl.textContent = 'In Progress';
    statusDot.style.background = 'var(--warning)';
    statusContainer.style.borderColor = 'var(--warning-border)';
    statusContainer.style.color = 'var(--warning)';
  }
}

function render() {
  var files = allFiles;
  if (currentFilter !== 'all') files = files.filter(function(f) { return f.status === currentFilter; });
  if (searchQuery) {
    var q = searchQuery.toLowerCase();
    files = files.filter(function(f) {
      return f.newPath.toLowerCase().indexOf(q) !== -1 || f.language.toLowerCase().indexOf(q) !== -1 ||
        f.hunks.some(function(h) { return h.lines.some(function(l) { return l.content.toLowerCase().indexOf(q) !== -1; }); });
    });
  }
  var fl = document.getElementById('fileList');
  if (!files.length) {
    fl.innerHTML = '<div class="empty"><div class="icon">&#128269;</div><h3>No matching diffs</h3><p>Try a different filter or search term</p></div>';
    return;
  }
  var html = '';
  if (groupByFolder) {
    var groups = {};
    files.forEach(function(f) { var g = f.folder || '/'; if (!groups[g]) groups[g] = []; groups[g].push(f); });
    for (var gn in groups) {
      html += '<div class="folder-group">';
      html += '<div class="folder-header expanded" data-folder="' + esc(gn) + '">';
      html += '<span class="folder-icon">&#128193;</span>';
      html += '<span class="folder-name">' + esc(gn.toUpperCase()) + '</span>';
      html += '<span class="folder-count">' + groups[gn].length + '</span>';
      html += '<span class="folder-chevron">&#9654;</span>';
      html += '</div>';
      groups[gn].forEach(function(f) { html += renderFile(f); });
      html += '</div>';
    }
  } else {
    files.forEach(function(f) { html += renderFile(f); });
  }
  fl.innerHTML = html;
}

function renderFile(f) {
  var exp = expandedFiles.has(f.id);
  var dn = f.newPath === '/dev/null' ? f.oldPath : f.newPath;
  var parts = dn.split('/');
  var name = parts.pop() || dn;
  var folder = parts.join('/') + '/';
  var totalComments = (f.comments || []).length + f.hunks.reduce(function(s, h) { return s + (h.comments || []).length; }, 0);

  var h = '<div class="file-row' + (f.selected ? ' selected' : '') + '" data-id="' + f.id + '">';
  h += '<div class="file-main" data-file-id="' + f.id + '">';
  h += '<span class="file-checkbox' + (f.selected ? ' checked' : '') + '" data-file-id="' + f.id + '">' + (f.selected ? '&#10003;' : '') + '</span>';
  h += '<span class="file-chevron ' + (exp ? 'expanded' : '') + '">&#9654;</span>';
  h += '<div class="file-info">';
  h += '<div class="file-path-row">';
  h += '<span class="file-path"><span class="folder-part">' + esc(folder) + '</span><span class="name-part">' + esc(name) + '</span></span>';
  h += '</div>';
  h += '<div class="file-badges">';
  if (f.isNewFile) h += '<span class="badge badge-new">New</span>';
  if (f.isDeleted) h += '<span class="badge badge-deleted">Deleted</span>';
  if (f.isRenamed) h += '<span class="badge badge-renamed">Renamed</span>';
  h += '<span class="badge badge-risk-' + f.risk + '">' + f.risk.toUpperCase() + '</span>';
  h += '<span class="badge badge-lang">' + esc(f.language.toUpperCase()) + '</span>';
  h += '<span class="badge badge-status-' + f.status + '">' + f.status.toUpperCase() + '</span>';
  if (totalComments > 0) h += '<span class="badge" style="background:var(--purple-bg);color:var(--purple)">&#128172;' + totalComments + '</span>';
  h += '</div></div>';
  h += '<span class="file-stats"><span class="add">+' + f.stats.additions + '</span><span class="del">-' + f.stats.deletions + '</span></span>';
  h += '<div class="file-actions">';
  h += '<button class="btn btn-xs btn-success" data-action="acceptFile" data-file-id="' + f.id + '" title="Accept">&#10003;</button>';
  h += '<button class="btn btn-xs btn-danger" data-action="rejectFile" data-file-id="' + f.id + '" title="Reject">&#10007;</button>';
  h += '</div></div>';

  if (f.riskReasons.length && (f.risk === 'high' || f.risk === 'critical')) {
    h += '<div class="risk-panel' + (f.risk === 'high' ? ' high' : '') + '">';
    h += '<div class="risk-title">&#9888; Risk Factors (' + f.risk.charAt(0).toUpperCase() + f.risk.slice(1) + ')</div>';
    h += '<ul class="risk-reasons">';
    f.riskReasons.forEach(function(r) { h += '<li>' + esc(r) + '</li>'; });
    h += '</ul></div>';
  }

  if (f.comments && f.comments.length) {
    h += '<div class="comment-section">';
    f.comments.forEach(function(c) {
      h += '<div class="comment' + (c.resolved ? ' comment-resolved' : '') + '">';
      h += '<div class="comment-avatar">' + c.author.charAt(0).toUpperCase() + '</div>';
      h += '<div class="comment-body"><div class="comment-author">' + esc(c.author) + '</div>';
      h += '<div class="comment-text">' + esc(c.text) + '</div>';
      h += '<div class="comment-time">' + timeAgo(c.createdAt) + (c.resolved ? ' &#10003; Resolved' : '') + '</div>';
      if (!c.resolved) h += '<div class="comment-actions"><button class="btn btn-xs btn-ghost" data-action="resolveComment" data-file-id="' + f.id + '" data-comment-id="' + c.id + '">Resolve</button></div>';
      h += '</div></div>';
    });
    h += '</div>';
  }

  h += '<div class="diff-content ' + (exp ? 'expanded' : '') + '" id="diff-' + f.id + '">';
  if (sideBySide) {
    var sbs = buildSBS(f);
    h += '<div class="sbs-view active"><div class="sbs-pane">' + sbs.left + '</div><div class="sbs-divider"></div><div class="sbs-pane">' + sbs.right + '</div></div>';
  } else {
    for (var hi = 0; hi < f.hunks.length; hi++) {
      var hk = f.hunks[hi];
      h += '<div class="hunk">';
      h += '<div class="hunk-header">';
      h += '<span class="hunk-code">@@ -' + hk.oldStart + ',' + hk.oldLines + ' +' + hk.newStart + ',' + hk.newLines + ' @@</span>';
      h += '<div class="hunk-actions">';
      h += '<button class="btn btn-xs btn-success" data-action="acceptHunk" data-file-id="' + f.id + '" data-hunk-id="' + hk.id + '">&#10003;</button>';
      h += '<button class="btn btn-xs btn-danger" data-action="rejectHunk" data-file-id="' + f.id + '" data-hunk-id="' + hk.id + '">&#10007;</button>';
      h += '<button class="btn btn-xs btn-ghost" data-action="addComment" data-file-id="' + f.id + '" data-hunk-id="' + hk.id + '">&#128172;</button>';
      h += '</div></div>';
      if (hk.comments && hk.comments.length) {
        h += '<div class="comment-section">';
        hk.comments.forEach(function(c) {
          h += '<div class="comment' + (c.resolved ? ' comment-resolved' : '') + '">';
          h += '<div class="comment-avatar">' + c.author.charAt(0).toUpperCase() + '</div>';
          h += '<div class="comment-body"><div class="comment-author">' + esc(c.author) + '</div>';
          h += '<div class="comment-text">' + esc(c.text) + '</div>';
          h += '<div class="comment-time">' + timeAgo(c.createdAt) + (c.resolved ? ' &#10003;' : '') + '</div>';
          if (!c.resolved) h += '<div class="comment-actions"><button class="btn btn-xs btn-ghost" data-action="resolveComment" data-file-id="' + f.id + '" data-comment-id="' + c.id + '">Resolve</button></div>';
          h += '</div></div>';
        });
        h += '</div>';
      }
      for (var li = 0; li < hk.lines.length; li++) {
        var ln = hk.lines[li];
        var marker = ln.type === 'added' ? '+' : ln.type === 'removed' ? '-' : ' ';
        var checked = ln.accepted ? 'checked' : '';
        h += '<div class="diff-line ' + ln.type + '">';
        if (ln.type !== 'context') {
          h += '<span class="line-check ' + checked + '" data-file-id="' + f.id + '" data-hunk-id="' + hk.id + '" data-line-index="' + li + '">' + (checked ? '&#10003;' : '') + '</span>';
        } else {
          h += '<span class="line-check"></span>';
        }
        h += '<span class="line-num">' + (ln.oldLineNumber || '') + '</span>';
        h += '<span class="line-num new">' + (ln.newLineNumber || '') + '</span>';
        h += '<span class="line-marker ' + ln.type + '">' + marker + '</span>';
        h += '<span class="line-content">' + esc(ln.content) + '</span>';
        h += '</div>';
      }
      h += '</div>';
    }
  }
  h += '</div></div>';
  return h;
}

function buildSBS(f) {
  var left = '', right = '';
  for (var hi = 0; hi < f.hunks.length; hi++) {
    var hk = f.hunks[hi];
    for (var li = 0; li < hk.lines.length; li++) {
      var ln = hk.lines[li];
      if (ln.type === 'context') {
        left += '<div class="diff-line context"><span class="line-num">' + (ln.oldLineNumber || '') + '</span><span class="line-content">' + esc(ln.content) + '</span></div>';
        right += '<div class="diff-line context"><span class="line-num">' + (ln.newLineNumber || '') + '</span><span class="line-content">' + esc(ln.content) + '</span></div>';
      } else if (ln.type === 'added') {
        left += '<div class="diff-line"><span class="line-num"></span><span class="line-content"></span></div>';
        right += '<div class="diff-line added"><span class="line-num">' + (ln.newLineNumber || '') + '</span><span class="line-marker added">+</span><span class="line-content">' + esc(ln.content) + '</span></div>';
      } else if (ln.type === 'removed') {
        left += '<div class="diff-line removed"><span class="line-num">' + (ln.oldLineNumber || '') + '</span><span class="line-marker removed">-</span><span class="line-content">' + esc(ln.content) + '</span></div>';
        right += '<div class="diff-line"><span class="line-num"></span><span class="line-content"></span></div>';
      }
    }
  }
  return { left: left, right: right };
}

function updateStats(s) {
  if (!s) return;
  document.getElementById('sTotal').textContent = s.totalFiles;
  document.getElementById('sPending').textContent = s.pending;
  document.getElementById('sAccepted').textContent = s.accepted;
  document.getElementById('sRejected').textContent = s.rejected;
  document.getElementById('sAdd').textContent = '+' + s.additions;
  document.getElementById('sDel').textContent = '-' + s.deletions;
  document.getElementById('sConflict').textContent = s.conflicts;
  document.getElementById('sComments').textContent = s.totalComments;
  document.getElementById('progressPct').textContent = s.progressPercent + '%';
  document.getElementById('progressFill').style.width = s.progressPercent + '%';
  if (s.progressPercent === 100) document.getElementById('progressFill').classList.add('complete');
  else document.getElementById('progressFill').classList.remove('complete');
  document.getElementById('fAll').textContent = s.totalFiles;
  document.getElementById('fPending').textContent = s.pending;
  document.getElementById('fAccepted').textContent = s.accepted;
  document.getElementById('fRejected').textContent = s.rejected;
  document.getElementById('fPartial').textContent = s.partial;
  document.getElementById('fConflict').textContent = s.conflicts;
}

function renderStatsPanel(s) {
  if (!s) return;
  var el = document.getElementById('statsContent');
  var h = '<div class="stat-row"><span class="label">Total Lines Changed</span><span class="value">+' + s.additions + ' / -' + s.deletions + '</span></div>';
  h += '<div class="stat-row"><span class="label">Average Risk Score</span><span class="value">' + s.avgRiskScore + '/4</span></div>';
  h += '<div class="stat-row"><span class="label">Comments (Resolved)</span><span class="value">' + s.totalComments + ' (' + s.resolvedComments + ')</span></div>';
  h += '<div class="stat-row"><span class="label">Selected for Batch</span><span class="value">' + s.selectedCount + '</span></div>';
  h += '<h3 style="margin-top:12px">&#128680; Risk Breakdown</h3>';
  var riskColors = { critical: 'var(--danger)', high: 'var(--warning)', medium: 'var(--warning)', low: 'var(--success)' };
  for (var level in s.riskBreakdown) {
    var count = s.riskBreakdown[level];
    var pct = s.totalFiles ? Math.round(count / s.totalFiles * 100) : 0;
    h += '<div class="stat-row"><span class="label">' + level + ' (' + count + ')</span><span class="value">' + pct + '%</span></div>';
    h += '<div class="stat-bar"><div class="stat-bar-fill" style="width:' + pct + '%;background:' + riskColors[level] + '"></div></div>';
  }
  if (s.topLanguages.length) {
    h += '<h3 style="margin-top:12px">&#128187; Languages</h3><div class="lang-list">';
    s.topLanguages.forEach(function(l) { h += '<span class="lang-tag">' + esc(l.name) + ' (' + l.count + ')</span>'; });
    h += '</div>';
  }
  if (s.topFolders.length) {
    h += '<h3 style="margin-top:12px">&#128193; Top Folders</h3>';
    s.topFolders.forEach(function(f) {
      var pct = s.totalFiles ? Math.round(f.count / s.totalFiles * 100) : 0;
      h += '<div class="stat-row"><span class="label">' + esc(f.name) + '</span><span class="value">' + f.count + ' (' + pct + '%)</span></div>';
    });
  }
  el.innerHTML = h;
}

function toggleFile(id) {
  if (expandedFiles.has(id)) expandedFiles.delete(id); else expandedFiles.add(id);
  var dc = document.getElementById('diff-' + id);
  if (dc) dc.classList.toggle('expanded');
  var ch = document.querySelector('.file-row[data-id="' + id + '"] .file-chevron');
  if (ch) ch.classList.toggle('expanded');
}

function selectFile(id, selected) { vscode.postMessage({ type: 'selectFile', fileId: id, selected: selected }); }

function acceptFile(id) {
  vscode.postMessage({ type: 'acceptFile', fileId: id });
  var file = allFiles.find(function(f) { return f.id === id; });
  if (file) {
    file.status = 'accepted';
    file.reviewedAt = Date.now();
    render();
    var stats = getCurrentStats();
    updateStats(stats);
    updateReviewStatus(stats);
  }
  showToast('Accepted', 'success');
}

function rejectFile(id) {
  vscode.postMessage({ type: 'rejectFile', fileId: id });
  var file = allFiles.find(function(f) { return f.id === id; });
  if (file) {
    file.status = 'rejected';
    file.reviewedAt = Date.now();
    render();
    var stats = getCurrentStats();
    updateStats(stats);
    updateReviewStatus(stats);
  }
  showToast('Rejected', 'warning');
}

function acceptHunk(fid, hid) { vscode.postMessage({ type: 'acceptHunk', fileId: fid, hunkId: hid }); showToast('Hunk accepted', 'success'); }
function rejectHunk(fid, hid) { vscode.postMessage({ type: 'rejectHunk', fileId: fid, hunkId: hid }); showToast('Hunk rejected', 'warning'); }
function toggleLine(fid, hid, li) { vscode.postMessage({ type: 'toggleLine', fileId: fid, hunkId: hid, lineIndex: li }); }

function acceptAll() {
  vscode.postMessage({ type: 'acceptAll' });
  allFiles.forEach(function(f) { if (f.status === 'pending' || f.status === 'partial') { f.status = 'accepted'; f.reviewedAt = Date.now(); } });
  render();
  var stats = getCurrentStats();
  updateStats(stats);
  updateReviewStatus(stats);
  showToast('All accepted', 'success');
}

function rejectAll() {
  vscode.postMessage({ type: 'rejectAll' });
  allFiles.forEach(function(f) { if (f.status === 'pending' || f.status === 'partial') { f.status = 'rejected'; f.reviewedAt = Date.now(); } });
  render();
  var stats = getCurrentStats();
  updateStats(stats);
  updateReviewStatus(stats);
  showToast('All rejected', 'warning');
}

function applyChanges() { vscode.postMessage({ type: 'applyChanges' }); showToast('Applying changes...', 'info'); }

function expandAll() { expandedFiles = new Set(allFiles.map(function(f) { return f.id; })); render(); }
function collapseAll() { expandedFiles.clear(); render(); }

function doUndo() { vscode.postMessage({ type: 'undo' }); }
function doRedo() { vscode.postMessage({ type: 'redo' }); }

function selectAll() {
  var allSelected = allFiles.length > 0 && allFiles.every(function(f) { return f.selected; });
  if (allSelected) {
    vscode.postMessage({ type: 'deselectAll' });
    allFiles.forEach(function(f) { f.selected = false; });
    render();
    showToast('All deselected', 'info');
  } else {
    vscode.postMessage({ type: 'selectAll' });
    allFiles.forEach(function(f) { f.selected = true; });
    render();
    showToast('All selected', 'info');
  }
}

function deselectAll() { vscode.postMessage({ type: 'deselectAll' }); allFiles.forEach(function(f) { f.selected = false; }); render(); showToast('All deselected', 'info'); }
function batchAccept() { vscode.postMessage({ type: 'batchAccept' }); }
function batchReject() { vscode.postMessage({ type: 'batchReject' }); }
function importClipboard() { vscode.postMessage({ type: 'importClipboard' }); showToast('Importing from clipboard...', 'info'); }
function importFromFile() { vscode.postMessage({ type: 'importFromFile' }); }
function importGitDiff() { vscode.postMessage({ type: 'importGitDiff' }); showToast('Importing git diff...', 'info'); }
function importFullGitDiff() { vscode.postMessage({ type: 'importFullGitDiff' }); showToast('Importing full diff...', 'info'); }
function exportPatch() { vscode.postMessage({ type: 'exportPatch' }); showToast('Patch exported', 'success'); }

function showStatsPanel() {
  statsPanelVisible = !statsPanelVisible;
  document.getElementById('statsPanel').style.display = statsPanelVisible ? 'block' : 'none';
  if (statsPanelVisible) renderStatsPanel(getCurrentStats());
}

function configureAutoDetect() { vscode.postMessage({ type: 'configureAutoDetect' }); }
function addComment(fid, hid) { vscode.postMessage({ type: 'addComment', fileId: fid, hunkId: hid }); }
function resolveComment(fid, cid) { vscode.postMessage({ type: 'resolveComment', fileId: fid, commentId: cid }); showToast('Comment resolved', 'success'); }

function getCurrentStats() {
  var s = { totalFiles: allFiles.length, pending: 0, accepted: 0, rejected: 0, partial: 0, conflicts: 0, additions: 0, deletions: 0, totalLines: 0, riskBreakdown: { low: 0, medium: 0, high: 0, critical: 0 }, languageBreakdown: {}, folderBreakdown: {}, statusBreakdown: { pending: 0, accepted: 0, rejected: 0, partial: 0, conflict: 0 }, progressPercent: 0, avgRiskScore: 0, totalComments: 0, resolvedComments: 0, selectedCount: 0, topLanguages: [], topFolders: [], hourlyActivity: new Array(24).fill(0) };
  var riskScores = { low: 1, medium: 2, high: 3, critical: 4 };
  allFiles.forEach(function(f) {
    if (f.status === 'pending') s.pending++; else if (f.status === 'accepted') s.accepted++; else if (f.status === 'rejected') s.rejected++; else if (f.status === 'partial') s.partial++; else if (f.status === 'conflict') s.conflicts++;
    s.additions += f.stats.additions; s.deletions += f.stats.deletions; s.riskBreakdown[f.risk]++; s.avgRiskScore += riskScores[f.risk];
    s.languageBreakdown[f.language] = (s.languageBreakdown[f.language] || 0) + 1; s.folderBreakdown[f.folder] = (s.folderBreakdown[f.folder] || 0) + 1;
    if (f.selected) s.selectedCount++;
    if (f.comments) { s.totalComments += f.comments.length; s.resolvedComments += f.comments.filter(function(c) { return c.resolved; }).length; }
  });
  if (s.totalFiles) s.avgRiskScore = Math.round(s.avgRiskScore / s.totalFiles * 10) / 10;
  var reviewed = s.accepted + s.rejected; s.progressPercent = s.totalFiles ? Math.round(reviewed / s.totalFiles * 100) : 0;
  s.topLanguages = Object.entries(s.languageBreakdown).map(function(e) { return { name: e[0], count: e[1] }; }).sort(function(a, b) { return b.count - a.count; }).slice(0, 5);
  s.topFolders = Object.entries(s.folderBreakdown).map(function(e) { return { name: e[0], count: e[1] }; }).sort(function(a, b) { return b.count - a.count; }).slice(0, 5);
  return s;
}

function showToast(text, level) {
  level = level || 'info';
  var el = document.getElementById('toast'); el.textContent = text;
  el.className = 'toast show' + (level !== 'info' ? ' ' + level : '');
  setTimeout(function() { el.classList.remove('show'); }, 2500);
}

function timeAgo(ts) {
  var diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
  return Math.floor(diff / 86400000) + 'd ago';
}

function esc(t) { var d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

document.addEventListener('keydown', function(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.ctrlKey && e.key === 'a' && !e.shiftKey) { e.preventDefault(); acceptAll(); }
  if (e.ctrlKey && e.key === 'r' && !e.shiftKey) { e.preventDefault(); rejectAll(); }
  if (e.ctrlKey && e.key === 'z') { e.preventDefault(); doUndo(); }
  if (e.ctrlKey && e.key === 'y') { e.preventDefault(); doRedo(); }
  if (e.ctrlKey && e.key === 'f') { e.preventDefault(); document.getElementById('searchInput').focus(); }
  if (e.key === 'Escape') { document.getElementById('searchInput').value = ''; searchQuery = ''; render(); document.getElementById('searchInput').blur(); }
});
`;
