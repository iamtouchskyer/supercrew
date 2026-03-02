# SuperCrew Kanban — Agent Instructions

## Architecture

- **Backend**: Hono on Bun (local dev) / Vercel serverless (production)
- **Frontend**: React + Vite + TanStack Router/Query, pnpm monorepo
- **Data**: GitHub Contents API (read/write `.team/` markdown files in user's repo)
- **Auth**: GitHub OAuth → JWT → GitHub API access_token
- **Registry**: Vercel KV (production) / FileRegistry JSON (local dev)

## Vercel Deployment

- `api/index.ts` is the Vercel serverless entry point — uses dynamic `import()` to load the backend ESM module from a CJS context
- `hono` and `@types/node` must be in root `dependencies` (not devDeps) — Vercel skips devDeps
- `installCommand` installs both root and backend deps
- Frontend uses pnpm@10 but Vercel ships pnpm 6 — use `npx pnpm@10` in buildCommand
- Don't add `packageManager` to root `package.json` — conflicts with npm installCommand

## Dual-Environment Notes

The backend runs on **Bun locally** and **Node.js on Vercel**.

- `@types/bun` masks missing `@types/node` — keep `@types/node` in **dependencies**
- `typescript` must be in backend **dependencies** — Vercel skips devDependencies
- Vercel filesystem is **read-only** — FileRegistry is guarded with `process.env.VERCEL` check
- `typeof Bun` check in `index.ts` is dead code on Vercel (Bun doesn't exist)
- `api/index.ts` must use dynamic `import()` — Vercel compiles to CJS, backend is ESM

## Verification Checklist (Before Deploy)

```bash
# From kanban/ directory:
npm run typecheck           # Backend Node.js typecheck
npm run test                # Unit tests
```

## Key Files

| File | Purpose |
|------|---------|
| `api/index.ts` | Vercel serverless entry point (dynamic import bridge) |
| `vercel.json` | Build config + URL rewrites |
| `backend/src/index.ts` | Hono app setup, route registration |
| `backend/src/store/github-store.ts` | GitHub Contents API CRUD |
| `backend/src/lib/get-github-context.ts` | JWT → access_token + repo resolution |
| `backend/src/registry/kv-registry.ts` | Vercel KV user/project storage |
| `backend/src/registry/file-registry.ts` | Local JSON file user/project storage |
| `backend/src/routes/auth.ts` | GitHub OAuth flow |
| `frontend/packages/local-web/` | Main frontend app |
| `frontend/packages/app-core/` | Shared hooks and API layer |

## Testing

- Framework: vitest
- Test files: `backend/src/__tests__/*.test.ts`
- Run: `npm test` (from kanban/ root)
- Mock `global.fetch` for GitHub API tests
- Mock registry for auth tests

## Common Mistakes to Avoid

1. Don't add `packageManager` to root `package.json` — conflicts with npm installCommand
2. Don't use static imports in `api/index.ts` — Vercel compiles to CJS, can't statically import ESM
3. Don't use `bun:test` imports — use vitest for cross-environment compat
4. Don't read `process.env` at module top-level for secrets (ESM hoisting risk)
5. Don't put type packages in devDependencies — Vercel won't install them
