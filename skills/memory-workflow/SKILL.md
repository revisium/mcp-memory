---
name: memory-workflow
description: Guides when and how to use Revisium memory tools. Use when the user asks to remember something, when starting a new session and needing prior context, when making decisions worth preserving, or when the user mentions memory, facts, or knowledge persistence.
user-invocable: false
---

# Revisium Memory Workflow

You have access to persistent, structured memory via Revisium MCP tools (`memory_*`). Use them to store and retrieve knowledge across sessions.

## When to store memory

- User says "remember this", "save this", "note that"
- A significant decision is made (architecture, library choice, convention)
- You discover a project pattern or convention worth preserving
- User preferences are expressed (coding style, tool preferences, workflow)
- A bug is solved with a non-obvious fix
- Important context that would be lost between sessions

## When to search memory

- At the start of a new session or after context compaction
- Before making a decision that might have prior context
- When the user asks "do you remember" or "what did we decide about"
- When working on a topic that likely has stored knowledge

## How to use the tools

### Storing

```
memory_store({ table: "facts", id: "descriptive-slug", data: { topic: "...", content: "...", confidence: 0.9 } })
```

Use descriptive IDs like `project-uses-nestjs`, `user-prefers-dark-theme`, `bug-fix-auth-race-condition`.

### Searching

```
memory_search({ table: "facts", field: "topic", value: "preferences" })
memory_search({ query: "auth" })  // search by row ID keyword
```

### Committing

Changes accumulate in a draft. When a meaningful milestone is reached:

1. Use `memory_diff` to review pending changes
2. Propose a commit to the user: briefly describe what changed
3. If the user approves, call `memory_commit({ message: "..." })`

**Never auto-commit.** Always propose and wait for approval.

### Recalling

```
memory_recall({ table: "facts", id: "specific-fact-id" })
```

## Tables

Default project has three tables:
- **facts** — knowledge, decisions, patterns, preferences (topic, content, confidence, source)
- **episodes** — session events, milestones (event, context, outcome, timestamp)
- **config** — agent configuration entries (value, description)

## Commit workflow

Think of memory like Git:
- `memory_store` / `memory_delete` = editing files (working directory)
- `memory_diff` = `git diff` (review changes)
- `memory_commit` = `git commit` (save snapshot)
- `memory_rollback` = `git checkout -- .` (discard changes)

Commits are for significant saves. Propose a commit when:
- A research session is complete
- Multiple related facts have been stored
- User explicitly asks to save/commit
- Before switching to a different topic
