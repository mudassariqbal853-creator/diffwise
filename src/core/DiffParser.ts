/**
 * DiffParser - Ultimate parser with conflict detection, risk scoring, language detection
 */

import { FileDiff, Hunk, DiffLine, RiskLevel, ConflictRegion } from './FileDiff';

let idCounter = 0;
function generateId(): string { return `diff_${Date.now()}_${idCounter++}`; }
function generateHunkId(): string { return `hunk_${Date.now()}_${idCounter++}`; }
function generateCommentId(): string { return `comment_${Date.now()}_${idCounter++}`; }

function detectLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  const langMap: Record<string, string> = {
    ts: 'TypeScript', tsx: 'TSX', js: 'JavaScript', jsx: 'JSX',
    py: 'Python', rb: 'Ruby', java: 'Java', cs: 'C#', cpp: 'C++',
    c: 'C', h: 'C Header', hpp: 'C++ Header', go: 'Go', rs: 'Rust',
    swift: 'Swift', kt: 'Kotlin', php: 'PHP', pl: 'Perl', lua: 'Lua', r: 'R',
    html: 'HTML', htm: 'HTML', css: 'CSS', scss: 'SCSS', less: 'Less',
    json: 'JSON', xml: 'XML', yaml: 'YAML', yml: 'YAML', toml: 'TOML',
    md: 'Markdown', rst: 'reStructuredText', sql: 'SQL', sh: 'Shell',
    bash: 'Bash', ps1: 'PowerShell', bat: 'Batch', aspx: 'ASP.NET',
    aspx_cs: 'C# Code-Behind', cshtml: 'Razor', dockerfile: 'Dockerfile',
    tf: 'Terraform', vb: 'VB.NET', fs: 'F#', dart: 'Dart',
  };
  return langMap[ext] || ext || 'Unknown';
}

function getFolder(filePath: string): string {
  const parts = filePath.replace(/\\/g, '/').split('/');
  return parts.length > 1 ? parts.slice(0, -1).join('/') : '/';
}

function calculateRisk(fileDiff: FileDiff): { level: RiskLevel; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  const { additions, deletions } = fileDiff.stats;
  const total = additions + deletions;

  if (total > 200) { score += 3; reasons.push(`Large change: ${total} lines`); }
  else if (total > 100) { score += 2; reasons.push(`Medium-large change: ${total} lines`); }
  else if (total > 50) { score += 1; reasons.push(`Medium change: ${total} lines`); }

  if (deletions > additions * 2) { score += 2; reasons.push(`Heavy deletion: ${deletions} removed vs ${additions} added`); }
  if (fileDiff.isNewFile) { score += 1; reasons.push('New file creation'); }
  if (fileDiff.isDeleted) { score += 3; reasons.push('File deletion'); }
  if (fileDiff.isRenamed) { score += 1; reasons.push('File renamed'); }
  if (fileDiff.conflictRegions && fileDiff.conflictRegions.length > 0) {
    score += 4; reasons.push(`${fileDiff.conflictRegions.length} merge conflict(s)`);
  }

  const sensitivePatterns = [
    { pattern: /config/i, reason: 'Configuration file', score: 2 },
    { pattern: /auth|login|password|secret|key|token|credential/i, reason: 'Security-sensitive file', score: 3 },
    { pattern: /db|database|migration|schema/i, reason: 'Database-related file', score: 2 },
    { pattern: /deploy|ci|pipeline|workflow/i, reason: 'Deployment/CI file', score: 2 },
    { pattern: /package\.json|requirements\.txt|pom\.xml|csproj/i, reason: 'Dependency file', score: 2 },
    { pattern: /\.env|\.gitignore|\.dockerignore/i, reason: 'Environment/ignore file', score: 1 },
    { pattern: /test|spec|\.test\.|\.spec\./i, reason: 'Test file', score: 1 },
    { pattern: /web\.config|appsettings|app\.config/i, reason: 'App configuration', score: 2 },
    { pattern: /stored.?proc|\.sql$/i, reason: 'SQL/Database file', score: 2 },
    { pattern: /api|controller|route|endpoint/i, reason: 'API/Route file', score: 2 },
    { pattern: /model|entity|schema|interface/i, reason: 'Data model file', score: 1 },
  ];

  for (const { pattern, reason, score: s } of sensitivePatterns) {
    if (pattern.test(fileDiff.newPath)) { score += s; reasons.push(reason); }
  }

  let level: RiskLevel = 'low';
  if (score >= 8) level = 'critical';
  else if (score >= 5) level = 'high';
  else if (score >= 2) level = 'medium';

  return { level, reasons };
}

export class DiffParser {

  public static parse(diffText: string): FileDiff[] {
    const files: FileDiff[] = [];
    const lines = diffText.split('\n');
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      if (line.startsWith('diff --git')) {
        const fileDiff = DiffParser.parseFileDiff(lines, i);
        if (fileDiff) { files.push(fileDiff.file); i = fileDiff.nextIndex; continue; }
      }

      if (line.startsWith('--- ') && i + 1 < lines.length && lines[i + 1].startsWith('+++ ')) {
        const fileDiff = DiffParser.parseSimpleDiff(lines, i);
        if (fileDiff) { files.push(fileDiff.file); i = fileDiff.nextIndex; continue; }
      }

      i++;
    }

    // Post-process
    for (const file of files) {
      file.folder = getFolder(file.newPath);
      file.language = detectLanguage(file.newPath);
      const risk = calculateRisk(file);
      file.risk = risk.level;
      file.riskReasons = risk.reasons;
      file.stats.totalLines = file.hunks.reduce((sum, h) => sum + h.lines.length, 0);
      file.comments = [];

      // Detect merge conflicts
      file.conflictRegions = DiffParser.detectConflicts(file);
      if (file.conflictRegions.length > 0) file.status = 'conflict';
    }

    return files;
  }

  private static detectConflicts(file: FileDiff): ConflictRegion[] {
    const conflicts: ConflictRegion[] = [];
    let inConflict = false;
    let conflictStart = 0;
    let ours: string[] = [];
    let theirs: string[] = [];
    let base: string[] = [];
    let section: 'ours' | 'theirs' | 'base' = 'ours';

    for (let i = 0; i < file.hunks.length; i++) {
      const hunk = file.hunks[i];
      for (let j = 0; j < hunk.lines.length; j++) {
        const line = hunk.lines[j];
        const content = line.content;

        if (content.startsWith('<<<<<<<')) {
          inConflict = true;
          conflictStart = line.newLineNumber || 0;
          ours = []; theirs = []; base = [];
          section = 'ours';
          hunk.lines[j].type = 'conflict_marker';
        } else if (content.startsWith('=======') && inConflict) {
          section = 'theirs';
          hunk.lines[j].type = 'conflict_marker';
        } else if (content.startsWith('>>>>>>>') && inConflict) {
          conflicts.push({ startLine: conflictStart, endLine: line.newLineNumber || 0, ours, theirs, base });
          inConflict = false;
          hunk.lines[j].type = 'conflict_marker';
        } else if (content.startsWith('|||||||') && inConflict) {
          section = 'base';
          hunk.lines[j].type = 'conflict_marker';
        } else if (inConflict) {
          if (section === 'ours') ours.push(content);
          else if (section === 'theirs') theirs.push(content);
          else if (section === 'base') base.push(content);
          hunk.lines[j].type = section === 'ours' ? 'conflict_ours' : section === 'theirs' ? 'conflict_theirs' : 'conflict_marker';
        }
      }
    }

    return conflicts;
  }

  private static parseFileDiff(lines: string[], startIndex: number): { file: FileDiff; nextIndex: number } | null {
    const headerLine = lines[startIndex];
    const pathMatch = headerLine.match(/^diff --git a\/(.+?) b\/(.+)$/);
    if (!pathMatch) return null;

    const oldPath = pathMatch[1];
    const newPath = pathMatch[2];

    let i = startIndex + 1;
    let isNewFile = false, isDeleted = false, isRenamed = false;
    let originalPath: string | undefined;

    while (i < lines.length && !lines[i].startsWith('--- ')) {
      if (lines[i].startsWith('new file')) isNewFile = true;
      if (lines[i].startsWith('deleted file')) isDeleted = true;
      const renameMatch = lines[i].match(/rename from (.+)/);
      if (renameMatch) { isRenamed = true; originalPath = renameMatch[1]; }
      i++;
    }

    if (i >= lines.length) return null;
    i += 2;

    const hunks: Hunk[] = [];
    let additions = 0, deletions = 0;

    while (i < lines.length) {
      const line = lines[i];
      if (line.startsWith('diff --git')) break;

      const hunkMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@\s*(.*)/);
      if (hunkMatch) {
        const hunk: Hunk = {
          id: generateHunkId(),
          oldStart: parseInt(hunkMatch[1]),
          oldLines: hunkMatch[2] ? parseInt(hunkMatch[2]) : 1,
          newStart: parseInt(hunkMatch[3]),
          newLines: hunkMatch[4] ? parseInt(hunkMatch[4]) : 1,
          lines: [],
          status: 'pending',
          description: hunkMatch[5] || undefined,
          comments: [],
        };

        i++;
        let oldLineNum = hunk.oldStart;
        let newLineNum = hunk.newStart;

        while (i < lines.length) {
          const hunkLine = lines[i];
          if (hunkLine.startsWith('diff --git')) break;
          if (hunkLine.startsWith('@@ ')) break;
          if (hunkLine.startsWith('--- ')) break;

          if (hunkLine.startsWith('+')) {
            hunk.lines.push({ type: 'added', content: hunkLine.substring(1), newLineNumber: newLineNum++, accepted: false, comments: [] });
            additions++;
          } else if (hunkLine.startsWith('-')) {
            hunk.lines.push({ type: 'removed', content: hunkLine.substring(1), oldLineNumber: oldLineNum++, accepted: false, comments: [] });
            deletions++;
          } else if (hunkLine.startsWith(' ')) {
            hunk.lines.push({ type: 'context', content: hunkLine.substring(1), oldLineNumber: oldLineNum++, newLineNumber: newLineNum++, comments: [] });
          } else if (hunkLine.startsWith('\\')) {
            hunk.lines.push({ type: 'header', content: hunkLine });
          } else if (hunkLine === '') {
            hunk.lines.push({ type: 'context', content: '', oldLineNumber: oldLineNum++, newLineNumber: newLineNum++, comments: [] });
          } else {
            break;
          }
          i++;
        }

        hunks.push(hunk);
        continue;
      }
      i++;
    }

    return {
      file: {
        id: generateId(),
        oldPath: isNewFile ? '/dev/null' : oldPath,
        newPath: isDeleted ? '/dev/null' : newPath,
        hunks,
        status: 'pending',
        stats: { additions, deletions, totalLines: 0 },
        risk: 'low',
        riskReasons: [],
        folder: getFolder(newPath),
        language: detectLanguage(newPath),
        isNewFile,
        isDeleted,
        isRenamed,
        originalPath,
        comments: [],
      },
      nextIndex: i,
    };
  }

  private static parseSimpleDiff(lines: string[], startIndex: number): { file: FileDiff; nextIndex: number } | null {
    const oldPathMatch = lines[startIndex].match(/^--- (?:a\/)?(.+?)(?:\t|\s|$)/);
    const newPathMatch = lines[startIndex + 1].match(/^\+\+\+ (?:b\/)?(.+?)(?:\t|\s|$)/);
    const oldPath = oldPathMatch ? oldPathMatch[1] : 'unknown';
    const newPath = newPathMatch ? newPathMatch[1] : oldPath;

    const isNewFile = oldPath === '/dev/null';
    const isDeleted = newPath === '/dev/null';

    let i = startIndex + 2;
    const hunks: Hunk[] = [];
    let additions = 0, deletions = 0;

    while (i < lines.length) {
      const line = lines[i];
      if (line.startsWith('--- ') || line.startsWith('diff --git')) break;

      const hunkMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
      if (hunkMatch) {
        const hunk: Hunk = {
          id: generateHunkId(),
          oldStart: parseInt(hunkMatch[1]),
          oldLines: hunkMatch[2] ? parseInt(hunkMatch[2]) : 1,
          newStart: parseInt(hunkMatch[3]),
          newLines: hunkMatch[4] ? parseInt(hunkMatch[4]) : 1,
          lines: [],
          status: 'pending',
          comments: [],
        };

        i++;
        let oldLineNum = hunk.oldStart;
        let newLineNum = hunk.newStart;

        while (i < lines.length) {
          const hunkLine = lines[i];
          if (hunkLine.startsWith('--- ') || hunkLine.startsWith('diff --git') || hunkLine.startsWith('@@ ')) break;

          if (hunkLine.startsWith('+')) {
            hunk.lines.push({ type: 'added', content: hunkLine.substring(1), newLineNumber: newLineNum++, accepted: false, comments: [] });
            additions++;
          } else if (hunkLine.startsWith('-')) {
            hunk.lines.push({ type: 'removed', content: hunkLine.substring(1), oldLineNumber: oldLineNum++, accepted: false, comments: [] });
            deletions++;
          } else if (hunkLine.startsWith(' ')) {
            hunk.lines.push({ type: 'context', content: hunkLine.substring(1), oldLineNumber: oldLineNum++, newLineNumber: newLineNum++, comments: [] });
          } else if (hunkLine.startsWith('\\')) {
            hunk.lines.push({ type: 'header', content: hunkLine });
          } else if (hunkLine === '') {
            hunk.lines.push({ type: 'context', content: '', oldLineNumber: oldLineNum++, newLineNumber: newLineNum++, comments: [] });
          } else {
            break;
          }
          i++;
        }

        hunks.push(hunk);
        continue;
      }
      i++;
    }

    return {
      file: {
        id: generateId(),
        oldPath: isNewFile ? '/dev/null' : oldPath,
        newPath: isDeleted ? '/dev/null' : newPath,
        hunks,
        status: 'pending',
        stats: { additions, deletions, totalLines: 0 },
        risk: 'low',
        riskReasons: [],
        folder: getFolder(newPath),
        language: detectLanguage(newPath),
        isNewFile,
        isDeleted,
        isRenamed: false,
        comments: [],
      },
      nextIndex: i,
    };
  }

  public static toUnifiedDiff(fileDiff: FileDiff): string {
    const lines: string[] = [];
    lines.push(`diff --git a/${fileDiff.oldPath} b/${fileDiff.newPath}`);
    if (fileDiff.isNewFile) lines.push('new file mode 100644');
    if (fileDiff.isDeleted) lines.push('deleted file mode 100644');
    lines.push(`--- ${fileDiff.oldPath === '/dev/null' ? '/dev/null' : 'a/' + fileDiff.oldPath}`);
    lines.push(`+++ ${fileDiff.newPath === '/dev/null' ? '/dev/null' : 'b/' + fileDiff.newPath}`);

    for (const hunk of fileDiff.hunks) {
      lines.push(`@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@${hunk.description ? ' ' + hunk.description : ''}`);
      for (const line of hunk.lines) {
        switch (line.type) {
          case 'added': lines.push(`+${line.content}`); break;
          case 'removed': lines.push(`-${line.content}`); break;
          case 'context': lines.push(` ${line.content}`); break;
          case 'header': lines.push(line.content); break;
          case 'conflict_ours': lines.push(`+${line.content}`); break;
          case 'conflict_theirs': lines.push(`+${line.content}`); break;
          case 'conflict_marker': lines.push(line.content); break;
        }
      }
    }
    return lines.join('\n');
  }

  public static toSideBySide(fileDiff: FileDiff): { left: SideBySideLine[]; right: SideBySideLine[] } {
    const left: SideBySideLine[] = [];
    const right: SideBySideLine[] = [];

    for (const hunk of fileDiff.hunks) {
      for (const line of hunk.lines) {
        switch (line.type) {
          case 'context':
            left.push({ number: line.oldLineNumber, content: line.content, type: 'context' });
            right.push({ number: line.newLineNumber, content: line.content, type: 'context' });
            break;
          case 'added':
            left.push({ number: undefined, content: '', type: 'empty' });
            right.push({ number: line.newLineNumber, content: line.content, type: 'added' });
            break;
          case 'removed':
            left.push({ number: line.oldLineNumber, content: line.content, type: 'removed' });
            right.push({ number: undefined, content: '', type: 'empty' });
            break;
          case 'conflict_ours':
            left.push({ number: line.oldLineNumber, content: line.content, type: 'conflict_ours' });
            right.push({ number: line.newLineNumber, content: line.content, type: 'conflict_ours' });
            break;
          case 'conflict_theirs':
            left.push({ number: line.oldLineNumber, content: line.content, type: 'conflict_theirs' });
            right.push({ number: line.newLineNumber, content: line.content, type: 'conflict_theirs' });
            break;
          case 'header':
            left.push({ number: undefined, content: line.content, type: 'header' });
            right.push({ number: undefined, content: '', type: 'header' });
            break;
          default:
            left.push({ number: line.oldLineNumber, content: line.content, type: 'context' });
            right.push({ number: line.newLineNumber, content: line.content, type: 'context' });
        }
      }
    }

    return { left, right };
  }
}

export interface SideBySideLine {
  number?: number;
  content: string;
  type: 'added' | 'removed' | 'context' | 'empty' | 'header' | 'conflict_ours' | 'conflict_theirs';
}
