# SuperCrew Plugin

See the [main README](../../README.md) for installation and usage.

## Plugin Internals

### Skills

| Skill | Triggers on |
|---|---|
| **using-supercrew** | Injected at session start — establishes behavior rules |
| **create-feature** | Creating a new feature |
| **update-status** | Status transitions (e.g. "mark as ready") |
| **sync-plan** | Generating or updating task breakdowns |
| **log-progress** | Recording what was done |
| **managing-features** | Auto-orchestrates lifecycle when `.supercrew/features/` exists |

### Hooks

- **SessionStart** — Scans `.supercrew/features/`, shows summary table, auto-loads active feature context based on current git branch.
