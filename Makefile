.PHONY: install dev build test typecheck lint verify clean help

# Default target
help:
	@echo "Usage: make <target>"
	@echo ""
	@echo "  install     Install all dependencies (backend + frontend)"
	@echo "  dev         Run backend + frontend dev servers"
	@echo "  build       Build frontend for production"
	@echo "  test        Run all tests (backend + app-core)"
	@echo "  typecheck   Run TypeScript type checks"
	@echo "  lint        Lint frontend code"
	@echo "  verify      Full verification (bundle + typecheck + tests)"
	@echo "  clean       Remove build artifacts and node_modules"
	@echo ""

# ── Install ──────────────────────────────────────────────
install:
	cd kanban/backend && bun install
	cd kanban/frontend && pnpm install

# ── Dev ──────────────────────────────────────────────────
dev:
	cd kanban && npm run dev

# ── Build ────────────────────────────────────────────────
build:
	cd kanban/frontend/packages/local-web && pnpm run build

# ── Test ─────────────────────────────────────────────────
test:
	cd kanban/backend && npm run test:vitest
	cd kanban/frontend/packages/app-core && pnpm run test

# ── Typecheck ────────────────────────────────────────────
typecheck:
	cd kanban/backend && npm run typecheck
	cd kanban/backend && npm run typecheck:node
	cd kanban/frontend/packages/local-web && pnpm run check

# ── Lint ─────────────────────────────────────────────────
lint:
	cd kanban/frontend/packages/local-web && pnpm run lint

# ── Verify (pre-deploy gate) ────────────────────────────
verify:
	cd kanban && npm run build:api
	cd kanban && npm run verify

# ── Clean ────────────────────────────────────────────────
clean:
	rm -rf kanban/api/index.js
	rm -rf kanban/backend/node_modules
	rm -rf kanban/frontend/node_modules
	rm -rf kanban/frontend/packages/local-web/dist
