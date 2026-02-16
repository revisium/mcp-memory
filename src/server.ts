import { createRequire } from 'node:module';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { Session } from './session.js';

const require = createRequire(import.meta.url);
const { version } = require('../package.json') as { version: string };
import { registerMemoryBranch } from './tools/memory-branch.js';
import { registerMemoryBranches } from './tools/memory-branches.js';
import { registerMemoryCommit } from './tools/memory-commit.js';
import { registerMemoryConfig } from './tools/memory-config.js';
import { registerMemoryCreateProject } from './tools/memory-create-project.js';
import { registerMemoryDelete } from './tools/memory-delete.js';
import { registerMemoryDiff } from './tools/memory-diff.js';
import { registerMemoryHistory } from './tools/memory-history.js';
import { registerMemoryProjects } from './tools/memory-projects.js';
import { registerMemoryRecall } from './tools/memory-recall.js';
import { registerMemoryRollback } from './tools/memory-rollback.js';
import { registerMemorySearch } from './tools/memory-search.js';
import { registerMemoryStatus } from './tools/memory-status.js';
import { registerMemoryStore } from './tools/memory-store.js';
import { registerMemorySwitchBranch } from './tools/memory-switch-branch.js';
import { registerMemorySwitchProject } from './tools/memory-switch-project.js';

export interface CreateServerOptions {
  url: string;
  username?: string;
  password?: string;
  token?: string;
  org?: string;
  project?: string;
  branch?: string;
  autoCommit?: boolean;
}

export function createServer(options: CreateServerOptions): {
  server: McpServer;
  session: Session;
} {
  const session = new Session({
    url: options.url,
    username: options.username,
    password: options.password,
    token: options.token,
    org: options.org,
    project: options.project ?? 'memory',
    branch: options.branch ?? 'master',
    autoCommit: options.autoCommit ?? false,
  });

  const server = new McpServer({
    name: '@revisium/mcp-memory',
    version,
  });

  registerMemoryStore(server, session);
  registerMemorySearch(server, session);
  registerMemoryRecall(server, session);
  registerMemoryDelete(server, session);
  registerMemoryConfig(server, session);
  registerMemoryCommit(server, session);
  registerMemoryDiff(server, session);
  registerMemoryRollback(server, session);
  registerMemoryStatus(server, session);

  registerMemoryProjects(server, session);
  registerMemoryCreateProject(server, session);
  registerMemorySwitchProject(server, session);

  registerMemoryBranch(server, session);
  registerMemorySwitchBranch(server, session);
  registerMemoryBranches(server, session);
  registerMemoryHistory(server, session);

  return { server, session };
}
