# DiffWise - AI Code Diff Reviewer

> Visual diff review panel for AI coding agents. Accept/reject changes at file, hunk, and line level.

![Version](https://img.shields.io/badge/version-0.5.0-blue)
![VS Code](https://img.shields.io/badge/VS_Code-%3E%3D1.90.0-007ACC)
![License](https://img.shields.io/badge/license-MIT-green)

---

## 🚀 Features

### Core Review Workflow
- **File-level** accept/reject with one click
- **Hunk-level** granular control over change blocks
- **Line-level** precision — accept or reject individual lines
- **Batch operations** — select multiple files and accept/reject together
- **Undo/Redo** — full history stack, never lose a decision

### Smart Import
- **Clipboard** — paste any unified diff directly
- **Git Diff** — import unstaged changes from your repo
- **Full Git Diff** — review all changes including staged
- **File Import** — load `.diff` or `.patch` files
- **Auto-detect** — automatically detects Cline/Continue output

### Visual Experience
- **Side-by-side diff view** — Cursor-style split pane comparison
- **Inline diff view** — classic unified diff with color coding
- **Risk scoring** — automatic risk assessment (Low / Medium / High / Critical)
- **Risk reasons** — see exactly why a change is flagged
- **Group by folder** — organize files by directory structure
- **Search & filter** — find changes by file, content, or language

### Productivity
- **Keyboard shortcuts** — `Ctrl+A` accept all, `Ctrl+R` reject all, `Ctrl+Z` undo
- **Filter tabs** — All / Pending / Accepted / Rejected / Partial / Conflicts
- **Sort options** — by path, risk, size, status, or language
- **Statistics dashboard** — track your review progress
- **Export patch** — save accepted changes as `.patch` file
- **Apply to disk** — write accepted changes directly to files

### Collaboration
- **Comments** — leave notes on files and hunks
- **Resolve comments** — mark discussions as resolved
- **Comment history** — full audit trail of review discussions

---

## 📦 Installation

1. Open VS Code
2. Press `Ctrl+Shift+X` (Extensions)
3. Search for **"DiffWise"**
4. Click **Install**

Or from command line:
```bash
code --install-extension diffwise.diffwise-ai
```

---

## 🎯 Quick Start

### Import a Diff
1. Open the DiffWise sidebar (click the icon in the Activity Bar)
2. Click **"Import Git Diff"** to review your current changes
3. Or paste a diff from clipboard with **"Import Clipboard"**

### Review Changes
1. Expand any file to see the diff
2. Click **✓** to accept or **✗** to reject at file, hunk, or line level
3. Use **Select All** + **Accept** for batch operations
4. Click **Apply** to write accepted changes to disk

### Keyboard Shortcuts
| Shortcut | Action |
|----------|--------|
| `Ctrl+A` | Accept all pending files |
| `Ctrl+R` | Reject all pending files |
| `Ctrl+Z` | Undo last action |
| `Ctrl+Y` | Redo |
| `Ctrl+F` | Focus search |
| `Esc` | Clear search |
| `Ctrl+Shift+D` | Open DiffWise panel |

---

## 🔍 How It Works

```
┌─────────────────────────────────────────────┐
│  Import diff (Git / Clipboard / File)       │
│                    ↓                         │
│  Parse into files → hunks → lines           │
│                    ↓                         │
│  Risk scoring (Low/Medium/High/Critical)    │
│                    ↓                         │
│  Review: Accept / Reject at any level       │
│                    ↓                         │
│  Apply accepted changes to disk             │
│  OR export as .patch file                   │
└─────────────────────────────────────────────┘
```

### Risk Scoring
DiffWise automatically scores each file's risk level:

| Risk | Criteria |
|------|----------|
| **Low** | Small changes, safe patterns |
| **Medium** | Moderate changes, some complexity |
| **High** | Large changes, critical files |
| **Critical** | Core files, breaking changes, high complexity |

---

## ⚙️ Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `diffwise.autoDetect` | `true` | Auto-detect file saves and import diffs |
| `diffwise.watchInterval` | `2000` | File watcher interval (ms) |
| `diffwise.defaultView` | `"inline"` | Default diff view (`inline` or `sidebyside`) |

---

## ️ Commands

| Command | Description |
|---------|-------------|
| `DiffWise: Open Panel` | Open the review sidebar |
| `DiffWise: Import from Clipboard` | Paste and parse a diff |
| `DiffWise: Import Git Diff` | Import unstaged git changes |
| `DiffWise: Import Full Git Diff` | Import all git changes |
| `DiffWise: Import from File` | Load a .diff/.patch file |
| `DiffWise: Apply Accepted Changes` | Write accepted changes to disk |
| `DiffWise: Export as Patch` | Save as .patch file |
| `DiffWise: Accept All` | Accept all pending files |
| `DiffWise: Reject All` | Reject all pending files |
| `DiffWise: Undo` | Undo last action |
| `DiffWise: Redo` | Redo last undone action |
| `DiffWise: Search in Diffs` | Search across all diffs |
| `DiffWise: Filter by Risk` | Filter by risk level |
| `DiffWise: Toggle Auto File Watcher` | Enable/disable auto-detect |

---

## 🤝 Works With

- **Cline** — Auto-detect AI-generated diffs
- **Continue** — Import Continue's output
- **GitHub Copilot** — Review Copilot's suggestions
- **Any AI coding agent** — Works with any unified diff output

---

## 📸 Screenshots

### Review Panel
![Review Panel](https://raw.githubusercontent.com/mudassariqbal853-creator/diffwise/main/media/screenshot-1.png)

### Side-by-Side View
![Side-by-Side](https://raw.githubusercontent.com/mudassariqbal853-creator/diffwise/main/media/screenshot-2.png)

### Statistics Dashboard
![Statistics](https://raw.githubusercontent.com/mudassariqbal853-creator/diffwise/main/media/screenshot-3.png)

---

## 📋 Changelog

See [CHANGELOG.md](./CHANGELOG.md) for the full release history.

---

## 🤝 Contributing

Contributions are welcome! Please open an issue or pull request at:
[github.com/mudassariqbal853-creator/diffwise](https://github.com/mudassariqbal853-creator/diffwise)

---

##  License

MIT License — see [LICENSE](./LICENSE) for details.

---

##  Acknowledgments

Built for developers who want full control over AI-generated code changes.

Made with ❤️ by [Mudassar Iqbal](https://github.com/mudassariqbal853-creator)
