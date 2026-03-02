# SuperCrew Kanban — Agent Instructions

## Architecture

- **Backend**: Hono on Bun (local dev) / Vercel serverless (production)
- **Frontend**: React + Vite + TanStack Router/Query, pnpm monorepo
- **Data**: GitHub Contents API (read/write `.team/` markdown files in user's repo)
- **Auth**: GitHub OAuth → JWT → GitHub API access_token
- **Registry**: Vercel KV (production) / FileRegistry JSON (local dev)

## Dual-Environment Pitfalls

The backend runs on **Bun locally** and **Node.js on Vercel**. This causes subtle issues:

### TypeScript
- `@types/bun` masks missing `@types/node` — always keep `@types/node` in **dependencies** (not devDependencies)
- `typescript` must also be in **dependencies** — Vercel sets `NODE_ENV=production` and skips devDependencies
- `moduleResolution: "bundler"` (Bun tsconfig) doesn't enforce `.js` extensions — use `tsconfig.node.json` with `"nodenext"` to catch these
- Run `npm run typecheck:node` before deploying to catch Node-specific TS errors

### Runtime
- `process.env.X` read at module top-level may be `undefined` due to ESM import hoisting — read env vars **inside functions**, not at module scope (exception: env vars that are always set like `VERCEL`)
- Vercel filesystem is **read-only** — any code that writes files (FileRegistry) must be guarded with `process.env.VERCEL` check
- `typeof Bun` check needs `declare const Bun: any` to satisfy Node TS compilation

### Vercel Deployment
- Serverless functions MUST be in `api/` at project root (relative to Vercel root dir) — `backend/api/` does NOT work
- `runtime` config value must be `"nodejs"` (not `"nodejs20.x"`)
- `packageManager` field in root package.json conflicts with custom `installCommand` using npm — don't add it
- Frontend uses pnpm@10 but Vercel ships pnpm 6 — use `npx pnpm@10` in buildCommand
- Rewrites destination must point to recognized function paths (e.g., `/api` not `/backend/api/index`)

## Verification Checklist (Before Deploy)

```bash
# From kanban/ directory:

# 1. Backend Node.js typecheck (catches Vercel TS issues)
cd backend && npm run typecheck:node

# 2. Unit tests
npm run test:vitest

# 3. Verify no bare relative imports (must have .js extension)
grep -r "from '\.\./.*[^s]'" src/ --include="*.ts" | grep -v ".js'" | grep -v node_modules

# 4. Verify no top-level process.env reads in new files
# (should be inside functions, not module scope)
```

## Key Files

| File | Purpose |
|------|---------|
| `api/index.ts` | Vercel serverless entry point |
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

- Framework: vitest (not bun:test — vitest works in both environments)
- Test files: `backend/src/__tests__/*.test.ts`
- Run: `cd backend && npm run test:vitest`
- Mock `global.fetch` for GitHub API tests
- Mock registry for auth tests
- Use `vi.mock()` for module mocks

## Common Mistakes to Avoid

1. Don't add `packageManager` to root `package.json` — conflicts with npm installCommand
2. Don't put serverless functions outside `api/` directory
3. Don't use `bun:test` imports — use vitest for cross-environment compat
4. Don't read `process.env` at module top-level for secrets
5. Don't forget `.js` extensions in relative imports
6. Don't put type packages in devDependencies — Vercel won't install them
