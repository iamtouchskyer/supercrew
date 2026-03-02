---
title: "Bottom Dock Navigation Design"
date: "2026-02-28"
author: admin
status: approved
---

## Goal

Replace the left vertical sidebar with a bottom ReactBits Dock for the main nav, and move theme/language toggles to the top-right corner.

## Layout

```
┌─────────────────────────────────────┐
│                          [Lang] [🌙] │  ← top-right, absolute
│                                     │
│              main                   │
│           (flex: 1)                 │
│                                     │
├─────────────────────────────────────┤
│       ⚡  ⊞  👥  📖  💡             │  ← ReactBits Dock
└─────────────────────────────────────┘
```

## Components

### Dock (`src/components/Dock.tsx`)
Copy-paste from reactbits.dev/components/dock. Props:
- `items` — array of `{ icon, label, onClick, className }`
- `magnification`, `distance`, `baseItemSize`, `panelHeight`
- Active item highlighted with `rb-accent` color

### `__root.tsx` changes
- Remove `<nav>` sidebar entirely
- Outer container: `flex-col` instead of `flex-row`
- `<main>` gets `flex: 1, position: relative`
- Bottom: `<Dock>` with Logo + 4 nav items
- Top-right: absolute `<LangToggle>` + theme button inside `<main>`

## Nav items in Dock

| Item | Icon | Route |
|------|------|-------|
| Logo (lightning) | LightningIcon | — (no nav, decorative) |
| Board | SquaresFourIcon | `/` |
| People | UsersIcon | `/people` |
| Knowledge | BookOpenIcon | `/knowledge` |
| Decisions | LightbulbIcon | `/decisions` |

## Active state
Dock items don't have native active state — detect via `pathname` and apply `color: var(--rb-accent)` + `fill` icon weight via `className` on the item's rendered icon.

## Sizing
- `baseItemSize`: 40px
- `magnification`: 64px
- `panelHeight`: 64px
- `distance`: 120px
