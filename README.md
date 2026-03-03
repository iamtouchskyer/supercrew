# SuperCrew

SuperCrew combines two things: a structured AI development workflow (powered by superpowers skills) and a kanban-style feature management app built with those same workflows.

## What's Inside

### `plugins/supercrew/` — The Claude Code Plugin

AI-driven feature lifecycle management. Track features from idea to done using structured `.supercrew/features/` directories in your repo.

**Install in Claude Code:**

```bash
# 1. Add the local marketplace (use absolute path)
/plugin marketplace add /path/to/supercrew/plugins/supercrew

# 2. Install the plugin
/plugin install supercrew@supercrew-dev

# 3. Verify
/plugin list
```

**Commands:**

| Command | Description |
|---|---|
| `/supercrew:new-feature` | Create a new feature with meta.yaml, design.md, plan.md, log.md |
| `/supercrew:feature-status` | Show all features status table |
| `/supercrew:work-on` | Switch active feature for this session |

**Feature lifecycle:**

```
planning → designing → ready → active → blocked → done
```

Each feature lives in `.supercrew/features/<id>/` with four files:

| File | Purpose |
|---|---|
| `meta.yaml` | ID, title, status, priority, owner, dates |
| `design.md` | Requirements, architecture, constraints |
| `plan.md` | Task breakdown with checklist & progress |
| `log.md` | Chronological progress entries |

The plugin's SessionStart hook auto-detects `feature/<id>` branches and loads context.

### `kanban/` — The Crew App

A read-only kanban board that visualizes features from `.supercrew/features/`. Connect a GitHub repo and see your feature lifecycle at a glance.

Features:
- GitHub OAuth login
- Connect a GitHub repo with `.supercrew/features/`
- 6-column kanban board: Planning → Designing → Ready → Active → Blocked → Done
- Feature detail page with Overview / Design / Plan tabs
- i18n (English / Chinese)
- Dark mode

**Stack:** Node.js + Bun backend, React + Vite + TanStack Router frontend

**Quick start:**

```bash
make install   # install all deps
make dev       # run backend + frontend
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001

**Other commands:**

```bash
make build     # build frontend for production
make test      # run all tests
make typecheck # TypeScript type checks
make lint      # lint frontend code
make verify    # full pre-deploy verification
make clean     # remove build artifacts & node_modules
```

### `plugins/` — Superpowers Skills

A curated set of AI coding workflow skills adapted from [obra/superpowers](https://github.com/obra/superpowers) by Jesse Vincent, plus original additions:

- **brainstorming** — Design-first, before touching code
- **writing-plans** — Bite-sized implementation plans
- **subagent-driven-development** — Fresh subagent per task + two-stage review
- **systematic-debugging** — 4-phase root cause investigation
- **test-driven-development** — RED-GREEN-REFACTOR cycle
- **team-sync** *(original)* — Team coordination skill
- ...and more

## Philosophy

- Design before code
- TDD always
- Systematic over ad-hoc
- Evidence over claims

## Credits

Skills workflow originally by [Jesse Vincent](https://github.com/obra) — [obra/superpowers](https://github.com/obra/superpowers).
The Crew app and additional skills by [iamtouchskyer](https://github.com/iamtouchskyer).

## License

MIT — see [LICENSE](./LICENSE) for details (includes original superpowers attribution).
