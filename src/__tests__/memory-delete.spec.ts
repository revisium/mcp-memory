import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { Session } from '../session.js';
import { registerMemoryDelete } from '../tools/memory-delete.js';

describe('memory_delete', () => {
  let server: McpServer;
  let session: any;
  let toolHandler: (params: Record<string, unknown>) => Promise<{
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
  }>;

  const mockDeleteRow = jest.fn<() => Promise<void>>();
  const mockDraft = {
    deleteRow: mockDeleteRow,
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

    registerMemoryDelete(server, session as Session);
  });

  it('should delete a row', async () => {
    mockDeleteRow.mockResolvedValue(undefined);

    const result = await toolHandler({
      table: 'facts',
      id: 'old-fact',
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0]?.text).toContain('deleted');
    expect(result.content[0]?.text).toContain('memory_commit');
    expect(mockDeleteRow).toHaveBeenCalledWith('facts', 'old-fact');
  });

  it('should return error when row not found', async () => {
    mockDeleteRow.mockRejectedValue(new Error('Row not found'));

    const result = await toolHandler({
      table: 'facts',
      id: 'nonexistent',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('Row not found');
  });

  it('should return error on connection failure', async () => {
    session.getDraft = jest
      .fn<() => Promise<unknown>>()
      .mockRejectedValue(new Error('Connection failed'));

    const result = await toolHandler({
      table: 'facts',
      id: 'test',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('Connection failed');
  });
});
