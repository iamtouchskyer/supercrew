# Repo Selection Combobox Design

**Date:** 2026-02-28
**Scope:** `crew/frontend/packages/local-web/src/routes/welcome.tsx` — `StepSelectRepo` component

---

## Problem

The current repo selection UI (search input + scrollable card list always visible) doesn't match the expected dropdown/combobox interaction pattern. Users expect to click a trigger and see a floating list of repos appear.

---

## Solution

Replace `StepSelectRepo`'s search+list layout with a **Radix Popover-based combobox**.

- **Trigger**: full-width button matching existing input styling; shows placeholder or selected repo name; ChevronDown icon rotates 180° when open.
- **Popover Content**: same width as trigger; search input (auto-focused) at top; scrollable repo list below (max 200px).
- **Repo rows**: `full_name` (bold, white) + description (gray, small) + private badge.
- **Selected state**: accent-color border + green tint background on active row.
- **Dismiss**: click outside, Escape key, or selecting a repo closes the popover and resets search input.

---

## Architecture

- **New dependency**: none — `@radix-ui/react-popover` already in `package.json`.
- **No new files**: all changes inside `StepSelectRepo` in `welcome.tsx`.
- **New import**: `{ Popover, PopoverTrigger, PopoverContent } from '@radix-ui/react-popover'` + `ChevronDownIcon` from `@phosphor-icons/react`.

---

## Data Flow

Unchanged — `useQuery(['github-repos'])` fetches from `/api/projects/github/repos`. The `filtered` array drives the list inside the popover.

---

## States

| State | Trigger display | Popover |
|-------|----------------|---------|
| Initial | "Select a repo…" (gray) | closed |
| Open, no selection | "Select a repo…" | open, search empty |
| Open, typing | "Select a repo…" | open, list filtered |
| Selected | `repo.full_name` (white) | closed |

---

## Testing

- Locale test (`locales.test.ts`) must stay green — no locale key changes needed.
- TypeScript check (`tsc --noEmit`) must pass on `welcome.tsx`.
- Manual smoke test: open dropdown → search → select repo → trigger shows repo name → Next button enabled.
