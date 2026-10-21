# Changelog

All notable changes to DiffWise will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.0] - 2026-10-21

### Added
- Initial release of DiffWise - AI Code Diff Reviewer
- File-level accept/reject with one-click actions
- Hunk-level granular control over change blocks
- Line-level precision for individual line acceptance/rejection
- Batch operations for multiple files
- Full undo/redo history stack
- Import from clipboard (unified diff)
- Import from Git (unstaged changes)
- Import full Git diff (all changes)
- Import from .diff/.patch files
- Auto-detect Cline/Continue output
- Side-by-side diff view (Cursor-style split pane)
- Inline diff view with color coding
- Automatic risk scoring (Low/Medium/High/Critical)
- Risk reasons display
- Group by folder organization
- Search and filter by file, content, or language
- Filter tabs: All/Pending/Accepted/Rejected/Partial/Conflicts
- Sort options: path, risk, size, status, language
- Statistics dashboard with progress tracking
- Export accepted changes as .patch file
- Apply accepted changes directly to disk
- Comments on files and hunks
- Resolve comments workflow
- Keyboard shortcuts (Ctrl+A, Ctrl+R, Ctrl+Z, Ctrl+Y, Ctrl+F)
- Auto file watcher for detecting changes
- Customizable settings

### Fixed
- Fixed icon display issues in webview header
- Fixed status updates not reflecting immediately
- Fixed Select All toggle behavior
- Fixed export patch file save dialog

### Changed
- Renamed extension from `diffwise` to `diffwise-ai` for marketplace uniqueness
- Improved CSP policy for webview security
- Enhanced event delegation for better UX

---

## [Unreleased]

### Planned
- AI-powered auto-accept for safe changes
- Team collaboration features
- Cloud sync across devices
- Integration with GitHub Actions and GitLab CI
- Custom review policies
- Analytics dashboard
- Premium tier with advanced features
