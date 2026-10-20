/**
 * FileDiff - Ultimate data model with all features
 */

export type LineType = 'added' | 'removed' | 'context' | 'header' | 'conflict_ours' | 'conflict_theirs' | 'conflict_marker';
export type FileStatus = 'pending' | 'accepted' | 'rejected' | 'partial' | 'conflict';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type HunkStatus = 'pending' | 'accepted' | 'rejected' | 'partial';
export type ViewMode = 'unified' | 'sidebyside' | 'conflict';
export type SortBy = 'path' | 'risk' | 'size' | 'status' | 'language';

export interface Comment {
  id: string;
  author: string;
  text: string;
  createdAt: number;
  resolved: boolean;
}

export interface DiffLine {
  type: LineType;
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
  accepted?: boolean;
  highlight?: boolean;
  comments?: Comment[];
}

export interface Hunk {
  id: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
  status: HunkStatus;
  description?: string;
  comments?: Comment[];
}

export interface FileDiff {
  id: string;
  oldPath: string;
  newPath: string;
  hunks: Hunk[];
  status: FileStatus;
  stats: { additions: number; deletions: number; totalLines: number };
  risk: RiskLevel;
  riskReasons: string[];
  folder: string;
  language: string;
  isNewFile: boolean;
  isDeleted: boolean;
  isRenamed: boolean;
  originalPath?: string;
  note?: string;
  reviewedAt?: number;
  comments?: Comment[];
  selected?: boolean;         // For batch operations
  conflictRegions?: ConflictRegion[];
}

export interface ConflictRegion {
  startLine: number;
  endLine: number;
  ours: string[];
  theirs: string[];
  base?: string[];
}

export interface DiffSession {
  id: string;
  title: string;
  createdAt: number;
  files: FileDiff[];
  source: 'clipboard' | 'file' | 'cline' | 'continue' | 'git' | 'manual' | 'watcher';
  applied: boolean;
  workspaceRoot?: string;
  gitBranch?: string;
  gitCommit?: string;
}

export interface SessionHistory {
  id: string;
  title: string;
  createdAt: number;
  fileCount: number;
  additions: number;
  deletions: number;
  source: string;
  applied: boolean;
  data: string; // Serialized session
}

export interface DiffAction {
  type: 'accept_file' | 'reject_file' | 'accept_hunk' | 'reject_hunk' | 'accept_line' | 'reject_line' | 'accept_all' | 'reject_all' | 'add_comment' | 'resolve_comment';
  fileId: string;
  hunkId?: string;
  lineIndex?: number;
  commentId?: string;
  timestamp: number;
}

export interface DiffStats {
  totalFiles: number;
  pending: number;
  accepted: number;
  rejected: number;
  partial: number;
  conflicts: number;
  additions: number;
  deletions: number;
  totalLines: number;
  riskBreakdown: Record<RiskLevel, number>;
  languageBreakdown: Record<string, number>;
  folderBreakdown: Record<string, number>;
  statusBreakdown: Record<FileStatus, number>;
  progressPercent: number;
  avgRiskScore: number;
  totalComments: number;
  resolvedComments: number;
  selectedCount: number;
  topLanguages: { name: string; count: number }[];
  topFolders: { name: string; count: number }[];
  hourlyActivity: number[];
}

export interface AutoDetectConfig {
  enabled: boolean;
  clinePath: string;
  continuePath: string;
  autoImport: boolean;
  pollInterval: number;
}
