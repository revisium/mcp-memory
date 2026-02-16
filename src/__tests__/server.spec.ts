import { describe, it, expect } from '@jest/globals';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { createServer } from '../server.js';

describe('createServer', () => {
  it('should create server and session', () => {
    const { server, session } = createServer({
      url: 'http://localhost:9222',
    });

    expect(server).toBeInstanceOf(McpServer);
    expect(session).toBeDefined();
    expect(session.getConfig().url).toBe('http://localhost:9222');
    expect(session.getConfig().project).toBe('memory');
    expect(session.getConfig().branch).toBe('master');
  });

  it('should use custom project and branch', () => {
    const { session } = createServer({
      url: 'http://localhost:9222',
      project: 'custom',
      branch: 'dev',
      org: 'my-org',
    });

    expect(session.getConfig().project).toBe('custom');
    expect(session.getConfig().branch).toBe('dev');
    expect(session.getConfig().org).toBe('my-org');
  });

  it('should pass auth options', () => {
    const { session } = createServer({
      url: 'http://localhost:9222',
      username: 'admin',
      password: 'pass',
      token: 'jwt-token',
    });

    expect(session.getConfig().username).toBe('admin');
    expect(session.getConfig().password).toBe('pass');
    expect(session.getConfig().token).toBe('jwt-token');
  });
});
