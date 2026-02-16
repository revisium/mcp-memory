import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { Session } from '../session.js';
import { registerMemoryRecall } from '../tools/memory-recall.js';

describe('memory_recall', () => {
  let server: McpServer;
  let session: any;
  let toolHandler: (params: Record<string, unknown>) => Promise<{
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
  }>;

  const mockGetRow =
    jest.fn<() => Promise<{ id: string; data: Record<string, unknown> }>>();

  const mockHead = {
    getRow: mockGetRow,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    session = {
      getHead: jest.fn<() => Promise<unknown>>().mockResolvedValue(mockHead),
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

    registerMemoryRecall(server, session as Session);
  });

  it('should return row data', async () => {
    mockGetRow.mockResolvedValue({
      id: 'nestjs-framework',
      data: { topic: 'architecture', content: 'Uses NestJS' },
    });

    const result = await toolHandler({
      table: 'facts',
      id: 'nestjs-framework',
    });

    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0]!.text) as Record<
      string,
      unknown
    >;
    expect(parsed['table']).toBe('facts');
    expect(parsed['id']).toBe('nestjs-framework');
    expect(parsed['data']).toEqual({
      topic: 'architecture',
      content: 'Uses NestJS',
    });
    expect(mockGetRow).toHaveBeenCalledWith('facts', 'nestjs-framework');
  });

  it('should return error when row not found', async () => {
    mockGetRow.mockRejectedValue(new Error('Row not found'));

    const result = await toolHandler({
      table: 'facts',
      id: 'nonexistent',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('Row not found');
  });

  it('should return error on connection failure', async () => {
    session.getHead = jest
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
