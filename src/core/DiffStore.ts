/**
 * DiffStore - Ultimate store with ALL features
 */

import * as vscode from 'vscode';
import * as path from 'path';
import {
  FileDiff, Hunk, DiffLine, DiffSession, DiffAction, DiffStats,
  RiskLevel, FileStatus, Comment, SessionHistory, AutoDetectConfig, SortBy
} from './FileDiff';
import { DiffParser } from './DiffParser';

export type DiffStoreListener = () => void;

export class DiffStore {
  private sessions: DiffSession[] = [];
  private activeSessionId: string | null = null;
  private listeners: DiffStoreListener[] = [];
  private undoStack: DiffAction[] = [];
  private redoStack: DiffAction[] = [];
  private sessionHistory: SessionHistory[] = [];
  private autoDetectConfig: AutoDetectConfig = {
    enabled: false, clinePath: '', continuePath: '', autoImport: false, pollInterval: 5000,
  };
  private autoDetectTimer: NodeJS.Timeout | null = null;
  private sortBy: SortBy = 'path';
  private filterStatus: FileStatus | 'all' = 'all';
  private filterRisk: RiskLevel | 'all' = 'all';
  private searchQuery = '';
  private groupByFolder = true;

  // ===== Listeners =====
  public onChange(listener: DiffStoreListener): () => void {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter(l => l !== listener); };
  }
  private notify(): void { this.listeners.forEach(l => l()); }

  // ===== Sessions =====
  public getActiveSession(): DiffSession | null {
    if (!this.activeSessionId) return null;
    return this.sessions.find(s => s.id === this.activeSessionId) || null;
  }
  public getSessions(): DiffSession[] { return this.sessions; }

  public createSession(title: string, diffText: string, source: DiffSession['source'] = 'manual'): DiffSession {
    const files = DiffParser.parse(diffText);
    const session: DiffSession = {
      id: `session_${Date.now()}`,
      title, createdAt: Date.now(), files, source, applied: false,
      workspaceRoot: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
    };
    this.sessions.push(session);
    this.activeSessionId = session.id;
    this.undoStack = [];
    this.redoStack = [];

    // Save to history
    this.sessionHistory.push({
      id: session.id, title: session.title, createdAt: session.createdAt,
      fileCount: files.length,
      additions: files.reduce((s, f) => s + f.stats.additions, 0),
      deletions: files.reduce((s, f) => s + f.stats.deletions, 0),
      source, applied: false, data: diffText,
    });

    this.notify();
    return session;
  }

  public addFilesToActiveSession(diffText: string, source: DiffSession['source'] = 'manual'): FileDiff[] {
    const files = DiffParser.parse(diffText);
    const session = this.getActiveSession();
    if (session) {
      session.files.push(...files);
      session.source = source;
    } else {
      this.createSession('Imported Diffs', diffText, source);
    }
    this.notify();
    return files;
  }

  public setActiveSession(sessionId: string): void { this.activeSessionId = sessionId; this.notify(); }

  public deleteSession(sessionId: string): void {
    this.sessions = this.sessions.filter(s => s.id !== sessionId);
    if (this.activeSessionId === sessionId) {
      this.activeSessionId = this.sessions.length > 0 ? this.sessions[this.sessions.length - 1].id : null;
    }
    this.notify();
  }

  public clearAll(): void {
    this.sessions = []; this.activeSessionId = null;
    this.undoStack = []; this.redoStack = [];
    this.notify();
  }

  // ===== Sorting & Filtering =====
  public setSortBy(sort: SortBy): void { this.sortBy = sort; this.notify(); }
  public setFilterStatus(status: FileStatus | 'all'): void { this.filterStatus = status; this.notify(); }
  public setFilterRisk(risk: RiskLevel | 'all'): void { this.filterRisk = risk; this.notify(); }
  public setSearchQuery(query: string): void { this.searchQuery = query; this.notify(); }
  public setGroupByFolder(group: boolean): void { this.groupByFolder = group; this.notify(); }

  public getSortedFilteredFiles(): FileDiff[] {
    const session = this.getActiveSession();
    if (!session) return [];
    let files = [...session.files];

    // Filter by status
    if (this.filterStatus !== 'all') files = files.filter(f => f.status === this.filterStatus);
    // Filter by risk
    if (this.filterRisk !== 'all') files = files.filter(f => f.risk === this.filterRisk);
    // Search
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      files = files.filter(f =>
        f.newPath.toLowerCase().includes(q) ||
        f.language.toLowerCase().includes(q) ||
        f.hunks.some(h => h.lines.some(l => l.content.toLowerCase().includes(q)))
      );
    }

    // Sort
    switch (this.sortBy) {
      case 'risk': {
        const riskOrder: Record<RiskLevel, number> = { critical: 0, high: 1, medium: 2, low: 3 };
        files.sort((a, b) => riskOrder[a.risk] - riskOrder[b.risk]);
        break;
      }
      case 'size':
        files.sort((a, b) => (b.stats.additions + b.stats.deletions) - (a.stats.additions + a.stats.deletions));
        break;
      case 'status': {
        const statusOrder: Record<FileStatus, number> = { conflict: 0, pending: 1, partial: 2, accepted: 3, rejected: 4 };
        files.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
        break;
      }
      case 'language':
        files.sort((a, b) => a.language.localeCompare(b.language));
        break;
      default:
        files.sort((a, b) => a.newPath.localeCompare(b.newPath));
    }

    return files;
  }

  // ===== Undo / Redo =====
  private pushUndo(action: DiffAction): void {
    this.undoStack.push(action);
    this.redoStack = [];
    if (this.undoStack.length > 100) this.undoStack.shift();
  }

  public undo(): boolean {
    const action = this.undoStack.pop();
    if (!action) return false;
    this.redoStack.push(action);
    this.applyUndoAction(action);
    this.notify();
    return true;
  }

  public redo(): boolean {
    const action = this.redoStack.pop();
    if (!action) return false;
    this.undoStack.push(action);
    this.applyRedoAction(action);
    this.notify();
    return true;
  }

  private applyUndoAction(action: DiffAction): void {
    const session = this.getActiveSession();
    if (!session) return;
    const file = session.files.find(f => f.id === action.fileId);
    if (!file) return;

    if (action.type === 'accept_file') file.status = 'pending';
    else if (action.type === 'reject_file') file.status = 'pending';
    else if (action.type === 'accept_hunk' && action.hunkId) {
      const hunk = file.hunks.find(h => h.id === action.hunkId);
      if (hunk) hunk.status = 'pending';
    } else if (action.type === 'reject_hunk' && action.hunkId) {
      const hunk = file.hunks.find(h => h.id === action.hunkId);
      if (hunk) hunk.status = 'pending';
    }
    this.recalcFileStatus(file);
  }

  private applyRedoAction(action: DiffAction): void {
    const session = this.getActiveSession();
    if (!session) return;
    const file = session.files.find(f => f.id === action.fileId);
    if (!file) return;

    if (action.type === 'accept_file') file.status = 'accepted';
    else if (action.type === 'reject_file') file.status = 'rejected';
    else if (action.type === 'accept_hunk' && action.hunkId) {
      const hunk = file.hunks.find(h => h.id === action.hunkId);
      if (hunk) hunk.status = 'accepted';
    } else if (action.type === 'reject_hunk' && action.hunkId) {
      const hunk = file.hunks.find(h => h.id === action.hunkId);
      if (hunk) hunk.status = 'rejected';
    }
    this.recalcFileStatus(file);
  }

  // ===== File-level =====
  public acceptFile(fileId: string): FileDiff | null {
    const file = this.findFile(fileId);
    if (file) {
      // Mark all hunks as accepted too
      file.hunks.forEach(h => h.status = 'accepted');
      file.status = 'accepted'; file.reviewedAt = Date.now();
      this.pushUndo({ type: 'accept_file', fileId, timestamp: Date.now() });
      this.notify();
    }
    return file || null;
  }

  public rejectFile(fileId: string): FileDiff | null {
    const file = this.findFile(fileId);
    if (file) {
      // Mark all hunks as rejected too
      file.hunks.forEach(h => h.status = 'rejected');
      file.status = 'rejected'; file.reviewedAt = Date.now();
      this.pushUndo({ type: 'reject_file', fileId, timestamp: Date.now() });
      this.notify();
    }
    return file || null;
  }

  // ===== Hunk-level =====
  public acceptHunk(fileId: string, hunkId: string): Hunk | null {
    const file = this.findFile(fileId);
    if (!file) return null;
    const hunk = file.hunks.find(h => h.id === hunkId);
    if (hunk) {
      hunk.status = 'accepted';
      this.pushUndo({ type: 'accept_hunk', fileId, hunkId, timestamp: Date.now() });
      this.recalcFileStatus(file); this.notify();
    }
    return hunk || null;
  }

  public rejectHunk(fileId: string, hunkId: string): Hunk | null {
    const file = this.findFile(fileId);
    if (!file) return null;
    const hunk = file.hunks.find(h => h.id === hunkId);
    if (hunk) {
      hunk.status = 'rejected';
      this.pushUndo({ type: 'reject_hunk', fileId, hunkId, timestamp: Date.now() });
      this.recalcFileStatus(file); this.notify();
    }
    return hunk || null;
  }

  // ===== Line-level =====
  public toggleLine(fileId: string, hunkId: string, lineIndex: number): void {
    const file = this.findFile(fileId);
    if (!file) return;
    const hunk = file.hunks.find(h => h.id === hunkId);
    if (!hunk) return;
    const line = hunk.lines[lineIndex];
    if (!line || line.type === 'context') return;
    line.accepted = !line.accepted;
    this.notify();
  }

  // ===== Batch Operations =====
  public selectFile(fileId: string, selected: boolean): void {
    const file = this.findFile(fileId);
    if (file) { file.selected = selected; this.notify(); }
  }

  public selectAll(): void {
    const session = this.getActiveSession();
    if (session) { session.files.forEach(f => f.selected = true); this.notify(); }
  }

  public deselectAll(): void {
    const session = this.getActiveSession();
    if (session) { session.files.forEach(f => f.selected = false); this.notify(); }
  }

  public batchAccept(): number {
    const session = this.getActiveSession();
    if (!session) return 0;
    const selected = session.files.filter(f => f.selected && (f.status === 'pending' || f.status === 'partial'));
    selected.forEach(f => { f.status = 'accepted'; f.reviewedAt = Date.now(); f.selected = false; });
    this.notify();
    return selected.length;
  }

  public batchReject(): number {
    const session = this.getActiveSession();
    if (!session) return 0;
    const selected = session.files.filter(f => f.selected && (f.status === 'pending' || f.status === 'partial'));
    selected.forEach(f => { f.status = 'rejected'; f.reviewedAt = Date.now(); f.selected = false; });
    this.notify();
    return selected.length;
  }

  // ===== Bulk =====
  public acceptAll(): FileDiff[] {
    const session = this.getActiveSession();
    if (!session) return [];
    const accepted = session.files.filter(f => f.status === 'pending' || f.status === 'partial' || f.status === 'conflict');
    accepted.forEach(f => { f.status = 'accepted'; f.reviewedAt = Date.now(); });
    this.pushUndo({ type: 'accept_all', fileId: '__all__', timestamp: Date.now() });
    this.notify();
    return accepted;
  }

  public rejectAll(): FileDiff[] {
    const session = this.getActiveSession();
    if (!session) return [];
    const rejected = session.files.filter(f => f.status === 'pending' || f.status === 'partial' || f.status === 'conflict');
    rejected.forEach(f => { f.status = 'rejected'; f.reviewedAt = Date.now(); });
    this.pushUndo({ type: 'reject_all', fileId: '__all__', timestamp: Date.now() });
    this.notify();
    return rejected;
  }

  // ===== Comments =====
  public addComment(fileId: string, hunkId: string | undefined, text: string, author = 'User'): Comment | null {
    const file = this.findFile(fileId);
    if (!file) return null;

    const comment: Comment = {
      id: `comment_${Date.now()}`, author, text,
      createdAt: Date.now(), resolved: false,
    };

    if (hunkId) {
      const hunk = file.hunks.find(h => h.id === hunkId);
      if (hunk) {
        if (!hunk.comments) hunk.comments = [];
        hunk.comments.push(comment);
      }
    } else {
      if (!file.comments) file.comments = [];
      file.comments.push(comment);
    }

    this.notify();
    return comment;
  }

  public resolveComment(fileId: string, commentId: string): void {
    const file = this.findFile(fileId);
    if (!file) return;

    const resolveIn = (comments: Comment[] | undefined) => {
      if (comments) {
        const c = comments.find(x => x.id === commentId);
        if (c) c.resolved = true;
      }
    };

    resolveIn(file.comments);
    for (const hunk of file.hunks) resolveIn(hunk.comments);
    this.notify();
  }

  // ===== Apply Changes =====
  public async applyAcceptedChanges(workspaceRoot: string): Promise<{ applied: number; errors: string[] }> {
    const session = this.getActiveSession();
    if (!session) return { applied: 0, errors: ['No active session'] };

    const errors: string[] = [];
    let applied = 0;

    for (const file of session.files) {
      if (file.status !== 'accepted' && file.status !== 'partial') continue;

      try {
        const targetPath = path.join(workspaceRoot, file.newPath);

        if (file.isDeleted) {
          try {
            await vscode.workspace.fs.delete(vscode.Uri.file(targetPath), { useTrash: true });
            applied++;
          } catch (e) { errors.push(`${file.newPath}: delete failed`); }
          continue;
        }

        if (file.isNewFile) {
          const content = this.buildNewFileContent(file);
          await vscode.workspace.fs.writeFile(vscode.Uri.file(targetPath), Buffer.from(content, 'utf8'));
          applied++;
          continue;
        }

        const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(targetPath));
        const originalLines = Buffer.from(bytes).toString('utf8').split('\n');
        const newLines = this.applyDiffToLines(originalLines, file);
        await vscode.workspace.fs.writeFile(vscode.Uri.file(targetPath), Buffer.from(newLines.join('\n'), 'utf8'));
        applied++;
      } catch (e) { errors.push(`${file.newPath}: ${e}`); }
    }

    session.applied = true;
    this.notify();
    return { applied, errors };
  }

  public async revertRejectedFiles(workspaceRoot: string): Promise<{ reverted: number; errors: string[] }> {
    const session = this.getActiveSession();
    if (!session) return { reverted: 0, errors: ['No active session'] };

    const errors: string[] = [];
    let reverted = 0;

    for (const file of session.files) {
      if (file.status !== 'rejected') continue;
      try {
        const terminal = vscode.window.createTerminal({ name: 'DiffWise Revert', cwd: workspaceRoot });
        terminal.sendText(`git checkout -- "${file.oldPath}"`, true);
        reverted++;
      } catch (e) { errors.push(`${file.oldPath}: revert failed`); }
    }

    this.notify();
    return { reverted, errors };
  }

  // ===== Auto-Detect Cline/Continue =====
  public setAutoDetectConfig(config: AutoDetectConfig): void {
    this.autoDetectConfig = config;
    this.startAutoDetect();
  }

  public getAutoDetectConfig(): AutoDetectConfig { return this.autoDetectConfig; }

  private startAutoDetect(): void {
    if (this.autoDetectTimer) clearInterval(this.autoDetectTimer);
    if (!this.autoDetectConfig.enabled) return;

    this.autoDetectTimer = setInterval(() => {
      this.checkForNewDiffs();
    }, this.autoDetectConfig.pollInterval);
  }

  private async checkForNewDiffs(): Promise<void> {
    const config = this.autoDetectConfig;

    // Check Cline diffs
    if (config.clinePath) {
      try {
        const clineDir = vscode.Uri.file(config.clinePath);
        const files = await vscode.workspace.fs.readDirectory(clineDir);
        const diffFiles = files.filter(([name]) => name.endsWith('.diff') || name.endsWith('.patch'));
        for (const [name] of diffFiles) {
          const filePath = path.join(config.clinePath, name);
          const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
          const text = Buffer.from(bytes).toString('utf8');
          if (text.trim()) {
            this.addFilesToActiveSession(text, 'cline');
            vscode.window.showInformationMessage(`DiffWise: Auto-imported ${name} from Cline`);
          }
        }
      } catch { /* Directory may not exist */ }
    }

    // Check Continue diffs
    if (config.continuePath) {
      try {
        const continueDir = vscode.Uri.file(config.continuePath);
        const files = await vscode.workspace.fs.readDirectory(continueDir);
        const diffFiles = files.filter(([name]) => name.endsWith('.diff') || name.endsWith('.patch'));
        for (const [name] of diffFiles) {
          const filePath = path.join(config.continuePath, name);
          const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
          const text = Buffer.from(bytes).toString('utf8');
          if (text.trim()) {
            this.addFilesToActiveSession(text, 'continue');
            vscode.window.showInformationMessage(`DiffWise: Auto-imported ${name} from Continue`);
          }
        }
      } catch { /* Directory may not exist */ }
    }
  }

  // ===== Git Integration =====
  public async importGitDiff(): Promise<FileDiff[]> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) return [];

    try {
      // Use execSync to capture output directly
      const { execSync } = require('child_process');
      const diffText = execSync('git diff --no-color', {
        cwd: workspaceRoot,
        encoding: 'utf8',
        timeout: 10000,
      }).trim();

      if (diffText) {
        const branch = await this.getGitBranch(workspaceRoot);
        const session = this.createSession(`Git Diff - ${branch}`, diffText, 'git');
        session.gitBranch = branch;
        return session.files;
      }
    } catch { /* No git or no changes */ }

    return [];
  }

  /**
   * Get diff for a single file path using git (staged + unstaged)
   */
  public async importFileGitDiff(filePath: string): Promise<FileDiff[]> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) return [];

    try {
      const { execSync } = require('child_process');

      // Check if file is tracked by git
      let isTracked = true;
      try {
        execSync(`git ls-files --error-unmatch -- "${filePath}"`, {
          cwd: workspaceRoot, encoding: 'utf8', timeout: 5000,
        });
      } catch {
        isTracked = false;
      }

      let diffText = '';

      if (isTracked) {
        // Get diff against HEAD (covers both staged and unstaged)
        diffText = execSync(`git diff --no-color HEAD -- "${filePath}"`, {
          cwd: workspaceRoot, encoding: 'utf8', timeout: 10000,
        }).trim();
      } else {
        // Untracked/new file — generate a diff showing entire file as added
        const fs = require('fs');
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf8');
          const lines = content.split('\n');
          const diffLines = lines.map((l: string) => '+' + l);
          diffText = [
            `diff --git a/${filePath} b/${filePath}`,
            `new file mode 100644`,
            `index 0000000..0000000`,
            `--- /dev/null`,
            `+++ b/${filePath}`,
            `@@ -0,0 +1,${lines.length} @@`,
            ...diffLines,
          ].join('\n');
        }
      }

      if (diffText) {
        const files = DiffParser.parse(diffText);
        const session = this.getActiveSession();
        if (session) {
          // Remove old version of this file from session if exists
          session.files = session.files.filter(f => f.newPath !== filePath);
          session.files.push(...files);
          this.notify();
        } else {
          this.createSession('Auto-detected Changes', diffText, 'watcher');
        }
        return files;
      }
    } catch { /* No diff for this file */ }

    return [];
  }

  /**
   * Get full git diff for ALL changed files (staged + unstaged + new files)
   */
  public async importFullGitDiff(): Promise<FileDiff[]> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) return [];

    try {
      const { execSync } = require('child_process');
      const fs = require('fs');

      // 1. Get diff for tracked files (staged + unstaged)
      let diffText = '';
      try {
        diffText = execSync('git diff --no-color HEAD', {
          cwd: workspaceRoot, encoding: 'utf8', timeout: 15000,
        }).trim();
      } catch { /* No tracked changes */ }

      // 2. Get list of untracked files (new files not yet added to git)
      let untrackedFiles: string[] = [];
      try {
        const untrackedOutput = execSync('git ls-files --others --exclude-standard', {
          cwd: workspaceRoot, encoding: 'utf8', timeout: 10000,
        }).trim();
        if (untrackedOutput) {
          untrackedFiles = untrackedOutput.split('\n').filter((f: string) => f.trim());
        }
      } catch { /* No untracked files */ }

      // 3. Generate diff for each untracked file
      for (const filePath of untrackedFiles) {
        const normalizedPath = filePath.replace(/\\/g, '/');
        const absolutePath = path.join(workspaceRoot, normalizedPath);
        try {
          if (fs.existsSync(absolutePath)) {
            const content = fs.readFileSync(absolutePath, 'utf8');
            const lines = content.split('\n');
            const diffLines = lines.map((l: string) => '+' + l);
            const fileDiff = [
              `diff --git a/${normalizedPath} b/${normalizedPath}`,
              `new file mode 100644`,
              `index 0000000..0000000`,
              `--- /dev/null`,
              `+++ b/${normalizedPath}`,
              `@@ -0,0 +1,${lines.length} @@`,
              ...diffLines,
            ].join('\n');
            diffText += (diffText ? '\n\n' : '') + fileDiff;
          }
        } catch { /* Skip unreadable files */ }
      }

      if (diffText) {
        const branch = await this.getGitBranch(workspaceRoot);
        const session = this.createSession(`Full Diff - ${branch}`, diffText, 'git');
        session.gitBranch = branch;
        return session.files;
      }
    } catch { /* No git or no changes */ }

    return [];
  }

  private async getGitBranch(workspaceRoot: string): Promise<string> {
    try {
      const terminal = vscode.window.createTerminal({ name: 'DiffWise Git', cwd: workspaceRoot });
      // Use a simpler approach - just return 'current' for now
      return 'current';
    } catch {
      return 'unknown';
    }
  }

  // ===== Session History =====
  public getSessionHistory(): SessionHistory[] { return this.sessionHistory; }

  public loadSessionFromHistory(historyId: string): DiffSession | null {
    const history = this.sessionHistory.find(h => h.id === historyId);
    if (!history) return null;
    return this.createSession(history.title, history.data, history.source as any);
  }

  // ===== Statistics =====
  public getStats(): DiffStats {
    const session = this.getActiveSession();
    const empty: DiffStats = {
      totalFiles: 0, pending: 0, accepted: 0, rejected: 0, partial: 0, conflicts: 0,
      additions: 0, deletions: 0, totalLines: 0,
      riskBreakdown: { low: 0, medium: 0, high: 0, critical: 0 },
      languageBreakdown: {}, folderBreakdown: {},
      statusBreakdown: { pending: 0, accepted: 0, rejected: 0, partial: 0, conflict: 0 },
      progressPercent: 0, avgRiskScore: 0,
      totalComments: 0, resolvedComments: 0, selectedCount: 0,
      topLanguages: [], topFolders: [], hourlyActivity: new Array(24).fill(0),
    };
    if (!session) return empty;

    const stats: DiffStats = { ...empty };
    stats.totalFiles = session.files.length;
    const riskScores: Record<RiskLevel, number> = { low: 1, medium: 2, high: 3, critical: 4 };

    for (const file of session.files) {
      if (file.status === 'pending') stats.pending++;
      else if (file.status === 'accepted') stats.accepted++;
      else if (file.status === 'rejected') stats.rejected++;
      else if (file.status === 'partial') stats.partial++;
      else if (file.status === 'conflict') stats.conflicts++;

      stats.additions += file.stats.additions;
      stats.deletions += file.stats.deletions;
      stats.totalLines += file.stats.totalLines;
      stats.riskBreakdown[file.risk]++;
      stats.statusBreakdown[file.status]++;
      stats.avgRiskScore += riskScores[file.risk];

      stats.languageBreakdown[file.language] = (stats.languageBreakdown[file.language] || 0) + 1;
      stats.folderBreakdown[file.folder] = (stats.folderBreakdown[file.folder] || 0) + 1;

      if (file.selected) stats.selectedCount++;
      if (file.comments) {
        stats.totalComments += file.comments.length;
        stats.resolvedComments += file.comments.filter(c => c.resolved).length;
      }
      for (const hunk of file.hunks) {
        if (hunk.comments) {
          stats.totalComments += hunk.comments.length;
          stats.resolvedComments += hunk.comments.filter(c => c.resolved).length;
        }
      }

      // Hourly activity
      if (file.reviewedAt) {
        const hour = new Date(file.reviewedAt).getHours();
        stats.hourlyActivity[hour]++;
      }
    }

    if (stats.totalFiles > 0) stats.avgRiskScore = Math.round((stats.avgRiskScore / stats.totalFiles) * 10) / 10;
    const reviewed = stats.accepted + stats.rejected;
    stats.progressPercent = stats.totalFiles > 0 ? Math.round((reviewed / stats.totalFiles) * 100) : 0;

    // Top languages
    stats.topLanguages = Object.entries(stats.languageBreakdown)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Top folders
    stats.topFolders = Object.entries(stats.folderBreakdown)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return stats;
  }

  // ===== Helpers =====
  private findFile(fileId: string): FileDiff | null {
    const session = this.getActiveSession();
    if (!session) return null;
    return session.files.find(f => f.id === fileId) || null;
  }

  public getPendingFiles(): FileDiff[] {
    const session = this.getActiveSession();
    if (!session) return [];
    return session.files.filter(f => f.status === 'pending' || f.status === 'partial');
  }

  public getAllFiles(): FileDiff[] {
    const session = this.getActiveSession();
    if (!session) return [];
    return session.files;
  }

  public getFilesByStatus(status: FileStatus): FileDiff[] {
    const session = this.getActiveSession();
    if (!session) return [];
    return session.files.filter(f => f.status === status);
  }

  public getFilesByRisk(risk: RiskLevel): FileDiff[] {
    const session = this.getActiveSession();
    if (!session) return [];
    return session.files.filter(f => f.risk === risk);
  }

  public searchInDiffs(query: string, caseSensitive = false): { fileId: string; hunkId: string; lineIndex: number; line: DiffLine }[] {
    const results: { fileId: string; hunkId: string; lineIndex: number; line: DiffLine }[] = [];
    const session = this.getActiveSession();
    if (!session) return results;
    const searchQuery = caseSensitive ? query : query.toLowerCase();

    for (const file of session.files) {
      for (const hunk of file.hunks) {
        for (let i = 0; i < hunk.lines.length; i++) {
          const line = hunk.lines[i];
          const content = caseSensitive ? line.content : line.content.toLowerCase();
          if (content.includes(searchQuery)) {
            results.push({ fileId: file.id, hunkId: hunk.id, lineIndex: i, line });
          }
        }
      }
    }
    return results;
  }

  private recalcFileStatus(file: FileDiff): void {
    const acceptedHunks = file.hunks.filter(h => h.status === 'accepted').length;
    const rejectedHunks = file.hunks.filter(h => h.status === 'rejected').length;
    const totalHunks = file.hunks.length;

    if (acceptedHunks === totalHunks) file.status = 'accepted';
    else if (rejectedHunks === totalHunks) file.status = 'rejected';
    else if (acceptedHunks > 0 || rejectedHunks > 0) file.status = 'partial';
    else file.status = 'pending';
  }

  private buildNewFileContent(file: FileDiff): string {
    const lines: string[] = [];
    for (const hunk of file.hunks) {
      for (const line of hunk.lines) {
        if (line.type === 'added' || line.type === 'context') lines.push(line.content);
      }
    }
    return lines.join('\n');
  }

  private applyDiffToLines(originalLines: string[], file: FileDiff): string[] {
    const result = [...originalLines];
    for (const hunk of file.hunks) {
      if (hunk.status === 'rejected') continue;
      for (let i = hunk.lines.length - 1; i >= 0; i--) {
        const line = hunk.lines[i];
        if (line.type === 'removed' && line.oldLineNumber !== undefined) {
          if (hunk.status === 'accepted' || line.accepted) {
            const idx = line.oldLineNumber - 1;
            if (idx >= 0 && idx < result.length) result.splice(idx, 1);
          }
        } else if (line.type === 'added' && line.newLineNumber !== undefined) {
          if (hunk.status === 'accepted' || line.accepted) {
            const idx = line.newLineNumber - 1;
            result.splice(idx, 0, line.content);
          }
        }
      }
    }
    return result;
  }
}

export const diffStore = new DiffStore();
