---
name: log-progress
description: "Use at the end of a coding session or when significant work has been completed on a feature. Appends a structured entry to log.md recording what was done, tasks completed, and issues encountered."
---

# Log Progress

## Overview

Append a progress entry to the active feature's `log.md`. This creates a chronological record of work done across sessions.

## When to Use

- At the end of a coding session (before the user leaves)
- After completing one or more tasks from `plan.md`
- When encountering a significant blocker or making a key decision
- When the `managing-features` skill prompts you to log

## Process

### Step 1: Gather Session Context

Automatically collect from the current session:

1. **What was worked on** — summarize the main activities (files changed, features implemented, bugs fixed)
2. **Tasks completed** — which `plan.md` tasks were checked off this session
3. **Issues encountered** — any blockers, unexpected problems, or decisions made
4. **Next steps** — what should be done in the next session

### Step 2: Append to `log.md`

Add a new entry at the **end** of the file (entries are chronological):

```markdown
## <YYYY-MM-DD> — <Brief summary of session>

### Completed
- <what was accomplished>
- <tasks completed from plan>

### Issues
- <any blockers or problems encountered>
- (none if no issues)

### Next Steps
- <what to do next session>
```

### Step 3: Update Metadata

- Update `meta.yaml` `updated` date to today

## Rules

- **Never overwrite** existing log entries — always **append**
- Keep entries concise but informative (someone reading the log should understand the feature's journey)
- If no issues were encountered, write "None" under Issues
- Always include Next Steps to give context for the next session
