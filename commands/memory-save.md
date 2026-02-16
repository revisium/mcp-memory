---
description: Review and commit pending memory changes
disable-model-invocation: true
---

Help the user commit pending memory changes:

1. Call `memory_diff` to see what changes are pending
2. If no changes, tell the user "No pending changes to commit"
3. If there are changes, summarize them concisely and ask the user for a commit message (or suggest one)
4. After user confirms, call `memory_commit` with the message
