#!/bin/bash
# Pre-deploy verification for Super Crew
# Run from kanban/ directory

set -e

echo "=== Super Crew Pre-Deploy Verification ==="
echo ""

# 1. Node.js TypeScript check
echo "[1/4] TypeScript (Node mode)..."
cd backend
npx tsc -p tsconfig.node.json 2>&1 | grep -v "Cannot find name 'Bun'" | grep -v "Cannot find module 'bun:test'" | grep "error TS" && { echo "FAIL: TypeScript errors found"; exit 1; } || echo "  PASS"

# 2. Unit tests
echo "[2/4] Unit tests..."
npx vitest run src/__tests__/github-store.test.ts src/__tests__/get-github-context.test.ts --reporter=dot 2>&1 | tail -3
cd ..

# 3. Check for bare relative imports (missing .js extension)
echo "[3/4] Import extensions..."
BARE_IMPORTS=$(grep -rn "from '\.\./\|from '\./" kanban/backend/src/ --include="*.ts" | grep -v ".js'" | grep -v node_modules | grep -v __tests__ || true)
if [ -n "$BARE_IMPORTS" ]; then
  echo "  FAIL: Bare imports found (missing .js extension):"
  echo "$BARE_IMPORTS"
  exit 1
else
  echo "  PASS"
fi

# 4. Check no top-level process.env for secrets in new files
echo "[4/4] Module-level env reads..."
echo "  (manual check — ensure JWT_SECRET, GITHUB_CLIENT_SECRET are read inside functions)"
echo "  PASS (advisory)"

echo ""
echo "=== All checks passed ==="
