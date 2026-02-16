import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { Session } from '../session.js';
import { registerMemoryStatus } from '../tools/memory-status.js';

describe('memory_status', () => {
  let server: McpServer;
  let session: any;
  let toolHandler: (params: Record<string, unknown>) => Promise<{
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
  }>;

  const mockGetChanges = jest.fn<() => Promise<{ totalChanges: number }>>();
  const mockGetTables = jest.fn<
    () => Promise<{
      edges: Array<{ node: { id: string } }>;
    }>
  >();

  const mockDraft = {
    getChanges: mockGetChanges,
    getTables: mockGetTables,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    session = {
      getConfig: jest.fn().mockReturnValue({
        url: 'http://localhost:9222',
        project: 'memory',
        branch: 'master',
        org: 'admin',
        token: 'jwt-token',
      }),
      isConnected: jest.fn().mockReturnValue(true),
      getDraft: jest.fn<() => Promise<unknown>>().mockResolvedValue(mockDraft),
    };

    server = new McpServer({ name: 'test', version: '0.1.0' });

    const originalRegisterTool = server.registerTool.bind(server);
    server.registerTool = ((
      name: string,
      config: unknown,
      handler: (params: Record<string, unknown>) => Promise<unknown>,
    ) => {
      toolHandler = handler as typeof toolHandler;
      return originalRegisterTool(name, config as any, handler as any);
    }) as typeof server.registerTool;

    registerMemoryStatus(server, session as Session);
  });

  it('should show status with token auth', async () => {
    mockGetChanges.mockResolvedValue({ totalChanges: 3 });
    mockGetTables.mockResolvedValue({
      edges: [{ node: { id: 'facts' } }, { node: { id: 'episodes' } }],
    });

    const result = await toolHandler({});
    const parsed = JSON.parse(result.content[0]!.text) as Record<
      string,
      unknown
    >;

    expect(parsed['url']).toBe('http://localhost:9222');
    expect(parsed['connected']).toBe(true);
    expect(parsed['auth']).toBe('token');
    expect(parsed['pendingChanges']).toBe(3);
    expect(parsed['tables']).toEqual(['facts', 'episodes']);
  });

  it('should show credentials auth type', async () => {
    session.getConfig.mockReturnValue({
      url: 'http://localhost:9222',
      project: 'memory',
      branch: 'master',
      username: 'admin',
    });
    mockGetChanges.mockResolvedValue({ totalChanges: 0 });
    mockGetTables.mockResolvedValue({ edges: [] });

    const result = await toolHandler({});
    const parsed = JSON.parse(result.content[0]!.text) as Record<
      string,
      unknown
    >;

    expect(parsed['auth']).toBe('credentials');
  });

  it('should show none auth type', async () => {
    session.getConfig.mockReturnValue({
      url: 'http://localhost:9222',
      project: 'memory',
      branch: 'master',
    });
    mockGetChanges.mockResolvedValue({ totalChanges: 0 });
    mockGetTables.mockResolvedValue({ edges: [] });

    const result = await toolHandler({});
    const parsed = JSON.parse(result.content[0]!.text) as Record<
      string,
      unknown
    >;

    expect(parsed['auth']).toBe('none');
  });

  it('should handle draft fetch failure gracefully', async () => {
    session.getDraft = jest
      .fn<() => Promise<unknown>>()
      .mockRejectedValue(new Error('Not connected'));

    const result = await toolHandler({});
    const parsed = JSON.parse(result.content[0]!.text) as Record<
      string,
      unknown
    >;

    expect(parsed['pendingChanges']).toBe('unable to fetch');
    expect(result.isError).toBeUndefined();
  });

  it('should handle top-level error', async () => {
    session.getConfig = jest.fn().mockImplementation(() => {
      throw new Error('Config error');
    });

    const result = await toolHandler({});

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('Config error');
  });
});
