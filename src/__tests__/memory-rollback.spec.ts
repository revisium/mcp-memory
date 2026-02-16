import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { Session } from '../session.js';
import { registerMemoryRollback } from '../tools/memory-rollback.js';

describe('memory_rollback', () => {
  let server: McpServer;
  let session: any;
  let toolHandler: (params: Record<string, unknown>) => Promise<{
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
  }>;

  const mockRevertChanges = jest.fn<() => Promise<void>>();
  const mockDraft = {
    revertChanges: mockRevertChanges,
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

    registerMemoryRollback(server, session as Session);
  });

  it('should revert changes', async () => {
    mockRevertChanges.mockResolvedValue(undefined);

    const result = await toolHandler({});

    expect(result.isError).toBeUndefined();
    expect(result.content[0]?.text).toContain('reverted');
    expect(mockRevertChanges).toHaveBeenCalled();
  });

  it('should return error on failure', async () => {
    mockRevertChanges.mockRejectedValue(new Error('Revert failed'));

    const result = await toolHandler({});

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('Revert failed');
  });

  it('should return error on connection failure', async () => {
    session.getDraft = jest
      .fn<() => Promise<unknown>>()
      .mockRejectedValue(new Error('Connection failed'));

    const result = await toolHandler({});

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('Connection failed');
  });
});
