---
name: team-sync
description: "Use when starting ANY new task or work session - registers your work to a shared file in git so teammates know what you're doing, and checks if anyone else is working in the same area"
---

# Team Sync

## Overview

One shared file in git. Every developer's AI reads it before starting work, writes to it when starting, and updates it when done. That's it.

**The file:** `docs/team/sync.md` in your project repo.

<HARD-GATE>
Before writing any code, you MUST:
1. Pull latest and read `docs/team/sync.md`
2. Check if anyone else is touching the same files/modules
3. Add your entry
4. Commit and push

If the file doesn't exist, create it with the template below.
</HARD-GATE>

## The File

```markdown
# Team Sync

| Who | What | Where (modules/files) | Branch | Started | Status |
|-----|------|-----------------------|--------|---------|--------|
| @alice | OAuth2 login | auth/, api/users/ | feat/oauth | 2025-02-27 | 🟡 active |
| @bob | Fix payment race | payments/queue.ts | fix/payment | 2025-02-27 | 🟡 active |
```

That's the entire file. One table.

## When Starting Work

```
1. git pull
2. Read docs/team/sync.md
3. Check: is anyone else's "Where" column overlapping with where I'm about to work?
   → If YES: tell the user "⚠️ @{who} is also working in {where} on branch {branch}. Coordinate?"
   → If NO: proceed
4. Add your row
5. git add docs/team/sync.md && git commit -m "sync: start {what}" && git push
```

## When Done

```
1. Change your Status to ✅ done (or remove your row)
2. git add docs/team/sync.md && git commit -m "sync: done {what}" && git push
```

## When Touching Shared Code

If you're modifying files that are imported by many other modules (shared utils, common types, API contracts, database schemas, CI configs):

Tell the user: "⚠️ You're changing shared code ({file}). Other active work that might be affected:" then list any active entries whose "Where" column touches related modules.

## Rules

- **One row per person per task.** Multiple tasks = multiple rows.
- **Keep it current.** If a row is >5 days old and still 🟡, flag it: "This entry looks stale — is @{who} still working on this?"
- **Merge conflicts are fine.** This is a simple table — resolve by keeping both rows.
- **Don't overthink "Where".** List the main directories or files. Doesn't need to be exhaustive.

## Creating the File

If `docs/team/sync.md` doesn't exist:

```bash
mkdir -p docs/team
cat > docs/team/sync.md << 'EOF'
# Team Sync

| Who | What | Where (modules/files) | Branch | Started | Status |
|-----|------|-----------------------|--------|---------|--------|
EOF
git add docs/team/sync.md && git commit -m "sync: initialize team sync file" && git push
```
