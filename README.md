# SuperCrew

SuperCrew combines two things: a structured AI development workflow (powered by superpowers skills) and a kanban-style team management app built with those same workflows.

## What's Inside

### `kanban/` — The Crew App

A lightweight team kanban board with GitHub integration. Features:
- GitHub OAuth login
- Connect a GitHub repo to your project
- Board, People, Knowledge, Decisions pages
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
