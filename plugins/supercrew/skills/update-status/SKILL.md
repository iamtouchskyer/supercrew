---
name: update-status
description: "Use when a feature's status needs to change — after design approval, when starting implementation, when blocked, or when work is complete. Updates meta.yaml status field following the valid state transition graph."
---

# Update Feature Status

## Overview

Update the `status` field in a feature's `meta.yaml`. Status changes must follow the valid transition graph.

## Valid Status Transitions

```
planning → designing       (design work has started)
designing → ready          (design approved, ready for implementation)
designing → planning       (design rejected, back to planning)
ready → active             (implementation has started)
active → blocked           (blocked by dependency or issue)
blocked → active           (blocker resolved)
active → done              (all tasks complete, verified)
```

**Invalid transitions** (e.g., `planning → active`, `done → active`) must be rejected with an explanation of which intermediate steps are needed.

## Process

### Step 1: Identify the Feature

- Use the active feature from the current session context (set by SessionStart hook or `/work-on`)
- If no active feature, ask the user which feature to update

### Step 2: Determine New Status

Infer the appropriate status transition based on context:

| Signal | Suggested Transition |
|--------|---------------------|
| `design.md` frontmatter `status` changed to `approved` | `designing → ready` |
| User says "start implementing" or begins writing code | `ready → active` |
| User mentions a blocker or dependency issue | `active → blocked` |
| Blocker resolved | `blocked → active` |
| All tasks in `plan.md` checked off, tests pass | `active → done` |
| Design rejected or needs rework | `designing → planning` |

If the transition is ambiguous, ask the user to confirm.

### Step 3: Update `meta.yaml`

1. Read the current `meta.yaml`
2. Validate the transition is legal (see graph above)
3. Update `status` to the new value
4. Update `updated` date to today (YYYY-MM-DD)
5. Write the file

### Step 4: Log the Change

Append to `log.md`:

```markdown
## <YYYY-MM-DD> — Status: <old_status> → <new_status>

- Reason: <brief reason for the transition>
```

## Validation

- Reject any transition not in the valid transitions graph
- Ensure `meta.yaml` required fields remain intact after edit
- `updated` date must be set to today
