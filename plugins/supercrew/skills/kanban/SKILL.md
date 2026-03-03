---
name: kanban
description: "Use when the user wants to see a kanban board, dashboard, or overview of all features and their statuses. Also use when asked about project progress, what's active, what's blocked, or overall feature status."
---

# Kanban Board

Display `.supercrew/features/` as a grouped kanban board in the terminal.

## Process

1. Run the kanban script from this skill's directory:

```bash
bash scripts/kanban.sh
```

2. Present the script output directly to the user — it is already formatted.

3. If the user asks about a specific feature, offer to run `/supercrew:work-on <id>` to switch to it.
