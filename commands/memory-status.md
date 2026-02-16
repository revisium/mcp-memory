---
description: Show memory status — connection, project, tables, and pending changes
disable-model-invocation: true
---

Check the current memory status and report to the user:

1. Call `memory_status` to get connection info, current project/branch, and pending changes count
2. If there are pending changes, call `memory_diff` to show what's uncommitted
3. Present a concise summary to the user
