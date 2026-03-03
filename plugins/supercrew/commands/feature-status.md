---
description: "Show the current status of all features tracked in .supercrew/features/. Displays a summary table with id, title, status, progress, priority, and owner."
disable-model-invocation: true
---

List all features in `.supercrew/features/` and display them in a table format:

| ID | Title | Status | Priority | Progress | Owner |
|---|---|---|---|---|---|

For each feature directory in `.supercrew/features/`:
1. Read `meta.yaml` for id, title, status, priority, owner
2. Read `plan.md` frontmatter for progress (completed_tasks/total_tasks)
3. Display the row

If no `.supercrew/features/` directory exists, tell the user to create their first feature with `/supercrew:new-feature`.
