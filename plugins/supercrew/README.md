# SuperCrew Plugin

AI-driven feature lifecycle management for Claude Code. Track features from idea to done using structured `.supercrew/features/` directories.

## Quick Start

### 1. Install the plugin

```bash
# In Claude Code, run these 3 commands in order:

# 1) Add the local marketplace (use absolute path to plugins/supercrew)
/plugin marketplace add /path/to/supercrew/plugins/supercrew

# 2) Install the plugin from the local marketplace
/plugin install supercrew@supercrew-dev

# 3) Verify installation — you should see supercrew listed
/plugin list
```

> Replace `/path/to/supercrew` with the actual absolute path to your supercrew repo clone.

**Reinstall / Update:**

```bash
/plugin uninstall supercrew@supercrew-dev
/plugin marketplace remove supercrew-dev
/plugin marketplace add /path/to/supercrew/plugins/supercrew
/plugin install supercrew@supercrew-dev
```

### 2. Create your first feature

```
/supercrew:new-feature
```

This creates `.supercrew/features/<feature-id>/` with four files:

| File | Purpose |
|---|---|
| `meta.yaml` | ID, title, status, priority, owner, dates |
| `design.md` | Requirements, architecture, constraints |
| `plan.md` | Task breakdown with checklist & progress |
| `log.md` | Chronological progress entries |

### 3. Work on a feature

```
/supercrew:work-on <feature-id>
```

Or simply check out a matching branch — the SessionStart hook auto-detects `feature/<id>` branches:

```bash
git checkout -b feature/my-feature
```

### 4. Check status

```
/supercrew:feature-status
```

Displays a table of all tracked features with status, priority, and progress.

## Feature Lifecycle

```
planning → designing → ready → active → blocked → done
                                  ↑         |
                                  └─────────┘
```

## Skills

| Skill | Triggers on |
|---|---|
| **using-supercrew** | Injected at session start — establishes behavior rules |
| **create-feature** | Creating a new feature |
| **update-status** | Status transitions (e.g. "mark as ready") |
| **sync-plan** | Generating or updating task breakdowns |
| **log-progress** | Recording what was done |
| **managing-features** | Auto-orchestrates lifecycle when `.supercrew/features/` exists |

## Commands

| Command | Description |
|---|---|
| `/supercrew:new-feature` | Create a new feature |
| `/supercrew:feature-status` | Show all features status |
| `/supercrew:work-on` | Switch active feature for this session |

## Hooks

- **SessionStart** — Scans `.supercrew/features/`, shows summary table, auto-loads active feature context based on current git branch.
