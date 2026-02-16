<div align="center">

# @revisium/mcp-memory

[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=revisium_mcp-memory&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=revisium_mcp-memory) [![Coverage](https://sonarcloud.io/api/project_badges/measure?project=revisium_mcp-memory&metric=coverage)](https://sonarcloud.io/summary/new_code?id=revisium_mcp-memory) [![GitHub License](https://img.shields.io/badge/License-MIT-green.svg)](https://github.com/revisium/mcp-memory/blob/master/LICENSE) [![GitHub Release](https://img.shields.io/github/v/release/revisium/mcp-memory)](https://github.com/revisium/mcp-memory/releases)

**Status: In Development**

MCP server that gives any AI coding assistant persistent, structured memory backed by [Revisium](https://revisium.io) — with versioning, branching, rollback, and a visual Admin UI for review.

Works with Claude Code, Cursor, Windsurf, Copilot, Cline, and any MCP-compatible client.

</div>

## Features

- **Structured memory** — store facts, episodes, and config as typed rows in tables
- **Version control** — commit, rollback, and view history of memory changes
- **Branching** — create branches for A/B testing agent configurations
- **Human review** — inspect and approve memory changes via Revisium Admin UI
- **Search** — filter and query memory entries by field values or row IDs
- **Multi-project** — organize memory into separate projects with templates
- **Zero-config** — auto-creates project and tables on first use

## Quick Start

### 1. Start Revisium

```bash
npx @revisium/standalone --port 9222
```

### 2. Configure your IDE

**Claude Code** (`~/.claude/settings.json`):
```json
{
  "mcpServers": {
    "memory": {
      "command": "npx",
      "args": ["@revisium/mcp-memory"],
      "env": {
        "REVISIUM_URL": "http://localhost:9222"
      }
    }
  }
}
```

**Cursor** (`.cursor/mcp.json`):
```json
{
  "mcpServers": {
    "memory": {
      "command": "npx",
      "args": ["@revisium/mcp-memory"],
      "env": {
        "REVISIUM_URL": "http://localhost:9222"
      }
    }
  }
}
```

**Windsurf** (`.windsurf/mcp.json`):
```json
{
  "mcpServers": {
    "memory": {
      "command": "npx",
      "args": ["@revisium/mcp-memory"],
      "env": {
        "REVISIUM_URL": "http://localhost:9222"
      }
    }
  }
}
```

### 3. Use it

The agent now has 17 memory tools available. On first `memory_store` call, a project with `facts`, `episodes`, and `config` tables is created automatically.

## Tools

### Level 1 — Core (zero-config)

| Tool | Description |
|------|-------------|
| `memory_store` | Store a fact/episode/config — creates or updates a row |
| `memory_search` | Search by table, field value, or row ID keyword |
| `memory_recall` | Get a specific entry by table and ID |
| `memory_delete` | Delete a memory entry |
| `memory_config` | Get/set/list agent configuration entries |
| `memory_commit` | Commit pending changes (like `git commit`) |
| `memory_diff` | Show pending changes (like `git diff`) |
| `memory_rollback` | Discard uncommitted changes (like `git checkout -- .`) |
| `memory_status` | Show connection, project, branch, and pending changes |

### Level 2 — Multi-project

| Tool | Description |
|------|-------------|
| `memory_projects` | List all memory projects |
| `memory_create_project` | Create a project from template |
| `memory_switch_project` | Switch active project |

### Level 3 — Branching

| Tool | Description |
|------|-------------|
| `memory_branch` | Create a new branch (like `git branch`) |
| `memory_switch_branch` | Switch to a different branch |
| `memory_branches` | List all branches |
| `memory_history` | Show revision history (like `git log`) |

### memory_store

```typescript
// Store a fact
await memory_store({
  table: 'facts',
  id: 'user-preference-theme',
  data: { topic: 'preferences', content: 'User prefers dark theme', confidence: 0.95 },
});

// Update an existing fact
await memory_store({
  table: 'facts',
  id: 'user-preference-theme',
  data: { topic: 'preferences', content: 'User switched to light theme', confidence: 0.99 },
});
```

### memory_search

```typescript
// Search by field value (string contains)
await memory_search({
  table: 'facts',
  field: 'topic',
  value: 'preferences',
  limit: 20,
});

// Search by row ID keyword
await memory_search({ table: 'facts', query: 'theme' });

// Search across all tables
await memory_search({ limit: 50 });
```

### memory_commit

```typescript
// Commit pending changes
await memory_commit({ message: 'Updated user preferences' });
```

### memory_branch

```typescript
// Create a branch
await memory_branch({ name: 'experiment-v2' });

// Switch to another branch
await memory_switch_branch({ name: 'experiment-v2' });

// List branches
await memory_branches({});
```

## Templates

Projects are created with a template that defines table schemas:

- **agent-memory** (default) — `facts`, `episodes`, `config` tables
- **bookmarks** — `bookmarks` table with tags and reading status
- **contacts** — `contacts`, `interactions` tables
- **expenses** — `expenses`, `budgets` tables
- **job-search** — `applications`, `contacts` tables
- **research** — `findings`, `decisions` tables
- **tasks** — `tasks`, `notes` tables

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REVISIUM_URL` | No | `http://localhost:9222` | Revisium server URL |
| `REVISIUM_USERNAME` | No | — | Username for login |
| `REVISIUM_PASSWORD` | No | — | Password for login |
| `REVISIUM_TOKEN` | No | — | JWT token (alternative to credentials) |
| `REVISIUM_PROJECT` | No | `memory` | Default project name |
| `REVISIUM_BRANCH` | No | `master` | Default branch name |
| `REVISIUM_ORG` | No | username | Organization ID |
| `REVISIUM_AUTO_COMMIT` | No | `false` | Auto-commit after `memory_store` and `memory_delete` |

When Revisium standalone runs with `--no-auth` (default), no credentials are needed.

## Programmatic Usage

```typescript
import { createServer } from '@revisium/mcp-memory';

const { server, session } = createServer({
  url: 'http://localhost:9222',
});

// Connect to any MCP transport
await server.connect(transport);
```

## Development

```bash
npm install
npm run tsc          # TypeScript check
npm run lint:ci      # ESLint
npm test             # Unit tests
npm run build        # Build CJS + ESM + .d.ts
```

### Integration tests

```bash
npm run test:integration:up    # Start Revisium standalone
npm run test:integration       # Run integration tests
npm run test:integration:down  # Stop Revisium
```

## License

MIT
