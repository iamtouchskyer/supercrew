import { Database } from 'bun:sqlite'
import { join } from 'path'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS features (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planning',
  owner TEXT,
  priority TEXT,
  branch TEXT NOT NULL DEFAULT 'main',
  teams TEXT DEFAULT '[]',
  tags TEXT DEFAULT '[]',
  blocked_by TEXT DEFAULT '[]',
  target_release TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  meta_yaml TEXT,
  design_md TEXT,
  plan_md TEXT,
  log_md TEXT,
  synced_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_features_status ON features(status);
CREATE INDEX IF NOT EXISTS idx_features_branch ON features(branch);
`

export function createDb(dbPath: string): Database {
  const db = new Database(dbPath)
  db.run(SCHEMA)
  return db
}

export function getDefaultDbPath(repoRoot: string): string {
  return join(repoRoot, '.supercrew', '.mcp-server.db')
}
