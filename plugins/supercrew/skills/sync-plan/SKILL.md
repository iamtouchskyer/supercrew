---
name: sync-plan
description: "Use after design approval to generate or update plan.md with task breakdown, or during implementation to update completed_tasks and progress. Syncs plan.md with the current state of the feature."
---

# Sync Plan

## Overview

Generate or update `plan.md` for a feature. This skill operates in two modes:

1. **Generate mode**: After design is approved, create the task breakdown from `design.md`
2. **Update mode**: During implementation, sync `completed_tasks` and `progress` with the actual checklist state

## Mode 1: Generate Task Breakdown

**When**: Feature status is `ready` (design approved) and `plan.md` has no real tasks yet.

### Process

1. Read `design.md` for the active feature
2. Break down the design into implementation tasks, each task should be:
   - Small enough to complete in one coding session (roughly 2-5 minutes for an AI agent)
   - Independently verifiable with a clear acceptance criterion
   - Ordered by dependency (earlier tasks don't depend on later ones)
3. Write tasks as checkbox items in `plan.md`:

```markdown
---
total_tasks: <count>
completed_tasks: 0
progress: 0
---

# <title> — Implementation Plan

## Tasks

- [ ] Task 1: <description>
  - File(s): `<file paths>`
  - Acceptance: <how to verify this task is done>
- [ ] Task 2: <description>
  - File(s): `<file paths>`
  - Acceptance: <how to verify>
...
```

4. Update `meta.yaml` `updated` date
5. Log the plan generation in `log.md`

## Mode 2: Update Progress

**When**: During implementation, tasks have been completed.

### Process

1. Read `plan.md` and count checked (`- [x]`) vs unchecked (`- [ ]`) tasks
2. Update the YAML frontmatter:
   - `completed_tasks`: count of `[x]` items
   - `total_tasks`: total count of task items
   - `progress`: `Math.round(completed_tasks / total_tasks * 100)`
3. Update `meta.yaml` `updated` date

## Validation

- `total_tasks` must equal the actual count of task checkbox items
- `completed_tasks` must equal the actual count of checked items
- `progress` must be `Math.round(completed_tasks / total_tasks * 100)`
- If `progress` reaches 100, suggest invoking `update-status` to transition to `done`
