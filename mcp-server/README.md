# SuperCrew MCP Server

Local MCP server for real-time feature management with Claude Code and Web UI.

## Quick Start

```bash
# Install dependencies
cd mcp-server
bun install

# Run in HTTP mode (for Web UI)
bun run src/index.ts

# Run in MCP mode (auto-detected when stdin is piped)
echo '{"method":"tools/list"}' | bun run src/index.ts
```

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `MCP_HTTP_PORT` | 3456 | HTTP API port |
| `MCP_WS_PORT` | 3457 | WebSocket port |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api/features` | List all features |
| GET | `/api/features/:id` | Get feature by ID |
| POST | `/api/features` | Create feature |
| PATCH | `/api/features/:id/status` | Update status |
| DELETE | `/api/features/:id` | Delete feature |
| GET | `/api/board` | Get board aggregation |

## MCP Tools

| Tool | Description |
|------|-------------|
| `list_features` | List all features |
| `get_feature` | Get feature details |
| `create_feature` | Create a new feature |
| `update_feature_status` | Update feature status |
| `log_progress` | Append to feature log |

## Dual Mode Operation

The server automatically detects its runtime mode:

- **MCP Mode**: When stdin is not a TTY (piped from Claude Code), runs as MCP server using stdio transport
- **HTTP Mode**: When stdin is a TTY (terminal), runs HTTP + WebSocket servers for Web UI

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                       SuperCrew MCP Server                          │
│                    (runs on localhost:3456/3457)                     │
│                                                                     │
│  ┌───────────────┐  ┌───────────────┐  ┌─────────────────────────┐ │
│  │ Feature Store │  │ Event Bus     │  │ GitHub Sync Worker      │ │
│  │ (SQLite)      │  │ (broadcasts)  │  │ (async push/pull)       │ │
│  └───────────────┘  └───────────────┘  └─────────────────────────┘ │
│         │                   │                       │               │
│  ┌──────┴───────────────────┴───────────────────────┴─────────────┐ │
│  │                     Branch Scanner                              │ │
│  │              (scans all branches, aggregates features)          │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└──────────┬───────────────────┬───────────────────┬──────────────────┘
           │                   │                   │
     MCP Protocol         WebSocket            HTTP API
           │                   │                   │
           ▼                   ▼                   ▼
    ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
    │ Claude Code │     │  Web UI     │     │   Clients   │
    │  (Agent)    │     │ (Browser)   │     │             │
    └─────────────┘     └─────────────┘     └─────────────┘
```

## WebSocket Events

The WebSocket server broadcasts real-time events:

| Event | Payload | Description |
|-------|---------|-------------|
| `connected` | `{ clientCount }` | Connection confirmed |
| `feature:created` | `{ feature }` | Feature created |
| `feature:updated` | `{ feature }` | Feature updated |
| `feature:deleted` | `{ featureId }` | Feature deleted |
| `conflict:detected` | `{ featureId, local, remote }` | Conflict detected |

## Development

```bash
# Run tests
bun test

# Type check
bun run typecheck

# Watch mode
bun run dev
```

## Data Storage

- **SQLite**: Primary data store at `.supercrew/.mcp-server.db`
- **Git**: Features synced to `.supercrew/features/<id>/` as backup

## License

MIT
