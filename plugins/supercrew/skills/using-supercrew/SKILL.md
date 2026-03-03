---
name: using-supercrew
description: "Use at session start to establish how supercrew skills work. Ensures features are tracked with structured lifecycle management."
---

<EXTREMELY_IMPORTANT>
You have the supercrew plugin installed. You MUST follow these rules for feature lifecycle management.

If a supercrew skill applies to the current task, you MUST invoke it. This is not optional.
</EXTREMELY_IMPORTANT>

# Using SuperCrew

## The Rule

**Check for applicable supercrew skills BEFORE taking action.** If the user is discussing features, planning, status updates, or progress — a supercrew skill almost certainly applies.

## How to Access Skills

**In Claude Code:** Use the `Skill` tool to invoke supercrew skills by name. When you invoke a skill, its content is loaded — follow it directly.

## When to Use Each Skill

| Trigger | Skill to Invoke |
|---------|----------------|
| User wants to create/start a new feature | `supercrew:create-feature` |
| User says "mark as ready/active/done/blocked" or status changes | `supercrew:update-status` |
| User finishes design, wants task breakdown, or tasks change | `supercrew:sync-plan` |
| User completed work, end of session, or checkpoint | `supercrew:log-progress` |
| `.supercrew/features/` exists and general lifecycle orchestration needed | `supercrew:managing-features` |

## Decision Flow

```
User message received
    ↓
Does it involve a feature? ──yes──→ Is there a .supercrew/features/ dir?
    │                                    │
    no                                  yes → Check which skill applies → Invoke it
    │                                    │
    ↓                                   no → Suggest /supercrew:new-feature
Respond normally
```

## Red Flags

These thoughts mean STOP — you're rationalizing skipping the skill:

| Thought | Reality |
|---------|---------|
| "I'll just update the file directly" | Use the skill — it ensures consistency |
| "This status change is trivial" | `update-status` validates transitions |
| "I'll log progress later" | Log NOW while context is fresh |
| "The plan doesn't need syncing" | `sync-plan` catches drift you won't notice |
| "I know the meta.yaml format" | Skills evolve. Invoke current version. |

## Available Commands

Users can invoke these directly:

- `/supercrew:new-feature` — Create a new feature
- `/supercrew:feature-status` — Show all features in a table
- `/supercrew:work-on <id>` — Switch active feature for this session

## Active Feature

When a feature is active (matched via `feature/<id>` branch or `/supercrew:work-on`), all skill operations target that feature by default. The SessionStart hook provides active feature context automatically.
