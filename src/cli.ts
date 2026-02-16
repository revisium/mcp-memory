import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { createServer } from './server.js';

const url = process.env['REVISIUM_URL'] ?? 'http://localhost:9222';
const username = process.env['REVISIUM_USERNAME'];
const password = process.env['REVISIUM_PASSWORD'];
const token = process.env['REVISIUM_TOKEN'];
const org = process.env['REVISIUM_ORG'];
const project = process.env['REVISIUM_PROJECT'];
const branch = process.env['REVISIUM_BRANCH'];

const { server, session } = createServer({
  url,
  username,
  password,
  token,
  org,
  project,
  branch,
});

void (async () => {
  await session.loadConfig();
  const transport = new StdioServerTransport();
  await server.connect(transport);
})();
