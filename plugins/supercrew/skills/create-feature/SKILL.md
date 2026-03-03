---
name: create-feature
description: "Use when the user wants to create a new feature, start a new project initiative, or when /new-feature command is invoked. Creates the .supercrew/features/<id>/ directory with meta.yaml, design.md, plan.md, and log.md."
---

# Create Feature

## Overview

Create a new feature in the `.supercrew/features/` directory. This skill guides the user through defining a feature, then generates the 4 required files.

## Process

### Step 1: Gather Feature Information

Ask the user for the following (one question at a time):

1. **Feature title** — a short, descriptive name (e.g., "User Authentication", "Dashboard Redesign")
2. **Feature ID** — suggest a kebab-case slug derived from the title (e.g., `user-auth`, `dashboard-redesign`). Let the user confirm or override.
3. **Priority** — P0 (critical) | P1 (high) | P2 (medium, default) | P3 (low)
4. **Owner** — who is responsible for this feature (default: current git user name)
5. **Brief description** — one sentence describing what this feature does and why

### Step 2: Create Feature Directory and Files

Create the directory `.supercrew/features/<feature-id>/` with 4 files.

**Use the templates in the plugin's `templates/` directory as reference for file structure.** Read the templates first, then generate files with the gathered information filled in.

#### File 1: `meta.yaml`

```yaml
id: <feature-id>
title: "<title>"
status: planning
owner: "<owner>"
priority: <P0|P1|P2|P3>
teams: []
tags: []
created: "<YYYY-MM-DD>"
updated: "<YYYY-MM-DD>"
```

#### File 2: `design.md`

```markdown
---
status: draft
reviewers: []
---

# <title>

## Background

<Brief description from user input>

## Requirements

<!-- To be refined during brainstorming -->

## Design

<!-- To be refined during brainstorming -->

## Out of Scope

<!-- To be defined -->
```

#### File 3: `plan.md`

```markdown
---
total_tasks: 0
completed_tasks: 0
progress: 0
---

# <title> — Implementation Plan

## Tasks

- [ ] Task 1: (to be defined after design approval)
```

#### File 4: `log.md`

```markdown
# <title> — Progress Log

## <YYYY-MM-DD> — Feature Created

- Feature initialized with status: `planning`
- Owner: <owner>
- Priority: <priority>
```

### Step 3: Confirm and Summarize

After creating all files, present a summary:

```
✅ Feature created: <feature-id>
📁 Location: .supercrew/features/<feature-id>/
📄 Files: meta.yaml, design.md, plan.md, log.md
🏷️ Status: planning | Priority: <priority> | Owner: <owner>

Next steps:
- Use brainstorming to refine the design in design.md
- Once design is approved, use sync-plan to generate the implementation plan
```

## Validation Rules

- Feature ID must be kebab-case (lowercase, hyphens only, no spaces)
- Feature ID must be unique (check `.supercrew/features/` for existing directories)
- Priority must be one of: P0, P1, P2, P3
- Status is always `planning` for new features
- `created` and `updated` dates use YYYY-MM-DD format (today's date)

## Important

- Do NOT start implementation after creating the feature. The next step is brainstorming/design.
- If `.supercrew/features/` directory doesn't exist yet, create it.
- If `.supercrew/` directory doesn't exist yet, create it.
