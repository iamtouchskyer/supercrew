# SuperCrew — Development Workflow

## Project Structure

- `kanban/` — Super Crew kanban app (Bun local / Vercel production, React + Vite frontend). See `kanban/CLAUDE.md` for detailed agent instructions.
- `plugins/` — Superpowers skills, hooks, commands, agents

## Workflow Rules

- All feature development MUST follow: brainstorming → writing-plans → subagent-driven-development
- All bugfixes MUST follow systematic root cause investigation (systematic-debugging skill)
- Before claiming work is complete, run verification-before-completion
- Worktrees go in `.worktrees/` (already gitignored)

## Skills

Skills live in `plugins/skills/`. They are loaded automatically by Claude Code from this directory — no plugin installation needed.

## Project Conventions

- Test framework: vitest
- Code style: ESLint + Prettier
- Branch naming: `feature/<name>`, `fix/<name>`
- Commits: concise, in English, describe the "why"
- Language: communicate with the user in Chinese (Simplified)
