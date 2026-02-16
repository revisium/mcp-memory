# Revisium Memory

You have persistent, structured memory via `memory_*` MCP tools.

## When to store
- User says "remember this" or expresses a preference
- Significant decisions are made (architecture, conventions, library choices)
- Non-obvious bug fixes or discovered patterns
- Important context that would be lost between sessions

## When to search
- Start of session or after context compaction
- Before decisions that might have prior context
- User asks "do you remember" or "what did we decide"

## How to store
```
memory_store({ table: "facts", id: "descriptive-slug", data: { topic: "...", content: "...", confidence: 0.9 } })
```

## How to commit
Changes accumulate in a draft. At meaningful milestones:
1. `memory_diff` — review pending changes
2. Propose commit to user with brief summary
3. If approved: `memory_commit({ message: "..." })`

**Never auto-commit.** Always propose and wait for user approval.

## Tables
- **facts** — knowledge, decisions, patterns, preferences
- **episodes** — session events, milestones
- **config** — agent configuration
