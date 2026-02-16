import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { createServer } from './server.js';
import { StandaloneManager } from './standalone-manager.js';

const url = process.env['REVISIUM_URL'] ?? 'http://localhost:9222';
const username = process.env['REVISIUM_USERNAME'];
const password = process.env['REVISIUM_PASSWORD'];
const token = process.env['REVISIUM_TOKEN'];
const org = process.env['REVISIUM_ORG'];
const project = process.env['REVISIUM_PROJECT'];
const branch = process.env['REVISIUM_BRANCH'];

const autoStart = process.env['REVISIUM_AUTO_START'] !== 'false';
const dataDir = process.env['REVISIUM_DATA_DIR'];
const pgPort = process.env['REVISIUM_PG_PORT']
  ? Number(process.env['REVISIUM_PG_PORT'])
  : undefined;

if (autoStart) {
  const manager = StandaloneManager.forUrl(url, {
    auth: Boolean(username && password),
    dataDir,
    pgPort,
  });
  if (manager) {
    await manager.ensureRunning();
  }
}

const { server, session } = createServer({
  url,
  username,
  password,
  token,
  org,
  project,
  branch,
});

await session.loadConfig();

const transport = new StdioServerTransport();
await server.connect(transport);
