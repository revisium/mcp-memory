import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { Session } from '../session.js';
import { registerMemoryCommit } from '../tools/memory-commit.js';

describe('memory_commit', () => {
  let server: McpServer;
  let session: any;
  let toolHandler: (params: Record<string, unknown>) => Promise<{
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
  }>;

  const mockGetChanges = jest.fn<() => Promise<{ totalChanges: number }>>();
  const mockCommit =
    jest.fn<() => Promise<{ id: string; createdAt: string }>>();

  const mockDraft = {
    getChanges: mockGetChanges,
    commit: mockCommit,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    session = {
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

    registerMemoryCommit(server, session as Session);
  });

  it('should commit with message', async () => {
    mockGetChanges.mockResolvedValue({ totalChanges: 3 });
    mockCommit.mockResolvedValue({
      id: 'rev-123',
      createdAt: '2024-01-01T00:00:00Z',
    });

    const result = await toolHandler({ message: 'Add new facts' });

    expect(result.content[0]?.text).toContain('rev-123');
    expect(result.content[0]?.text).toContain('3 changes');
    expect(mockCommit).toHaveBeenCalledWith('Add new facts');
  });

  it('should report no changes when nothing to commit', async () => {
    mockGetChanges.mockResolvedValue({ totalChanges: 0 });

    const result = await toolHandler({});

    expect(result.content[0]?.text).toContain('No pending changes');
    expect(mockCommit).not.toHaveBeenCalled();
  });

  it('should handle errors', async () => {
    session.getDraft = jest
      .fn<() => Promise<unknown>>()
      .mockRejectedValue(new Error('Not connected'));

    const result = await toolHandler({});

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('Not connected');
  });
});
