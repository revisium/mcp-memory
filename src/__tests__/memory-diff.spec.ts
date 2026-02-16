import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { Session } from '../session.js';
import { registerMemoryDiff } from '../tools/memory-diff.js';

describe('memory_diff', () => {
  let server: McpServer;
  let session: any;
  let toolHandler: (params: Record<string, unknown>) => Promise<{
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
  }>;

  const mockGetChanges = jest.fn<() => Promise<unknown>>();
  const mockGetRowChanges = jest.fn<() => Promise<unknown>>();
  const mockDraft = {
    getChanges: mockGetChanges,
    getRowChanges: mockGetRowChanges,
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

    registerMemoryDiff(server, session as Session);
  });

  it('should return "No pending changes" when no changes', async () => {
    mockGetChanges.mockResolvedValue({
      totalChanges: 0,
      tablesSummary: {
        total: 0,
        added: 0,
        modified: 0,
        removed: 0,
        renamed: 0,
      },
      rowsSummary: { total: 0, added: 0, modified: 0, removed: 0, renamed: 0 },
    });

    const result = await toolHandler({ limit: 20 });

    expect(result.isError).toBeUndefined();
    expect(result.content[0]?.text).toBe('No pending changes.');
    expect(mockGetRowChanges).not.toHaveBeenCalled();
  });

  it('should return summary and row changes', async () => {
    mockGetChanges.mockResolvedValue({
      totalChanges: 2,
      tablesSummary: {
        total: 1,
        added: 0,
        modified: 1,
        removed: 0,
        renamed: 0,
      },
      rowsSummary: { total: 2, added: 1, modified: 1, removed: 0, renamed: 0 },
    });
    mockGetRowChanges.mockResolvedValue({
      edges: [
        {
          node: {
            changeType: 'ADDED',
            table: { id: 'facts' },
            row: { id: 'new-fact' },
            fromRow: null,
            fieldChanges: [],
          },
        },
        {
          node: {
            changeType: 'MODIFIED',
            table: { id: 'facts' },
            row: { id: 'existing-fact' },
            fromRow: null,
            fieldChanges: [
              {
                fieldPath: 'content',
                changeType: 'MODIFIED',
                oldValue: 'old text',
                newValue: 'new text',
              },
            ],
          },
        },
      ],
    });

    const result = await toolHandler({ limit: 20 });

    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0]!.text) as Record<
      string,
      unknown
    >;
    expect(parsed['totalChanges']).toBe(2);
    expect(parsed['changes']).toHaveLength(2);
    expect(mockGetRowChanges).toHaveBeenCalledWith({ first: 20 });
  });

  it('should filter by table', async () => {
    mockGetChanges.mockResolvedValue({
      totalChanges: 1,
      tablesSummary: {
        total: 1,
        added: 0,
        modified: 1,
        removed: 0,
        renamed: 0,
      },
      rowsSummary: { total: 1, added: 1, modified: 0, removed: 0, renamed: 0 },
    });
    mockGetRowChanges.mockResolvedValue({ edges: [] });

    await toolHandler({ table: 'facts', limit: 10 });

    expect(mockGetRowChanges).toHaveBeenCalledWith({
      first: 10,
      tableId: 'facts',
    });
  });

  it('should return error on failure', async () => {
    session.getDraft = jest
      .fn<() => Promise<unknown>>()
      .mockRejectedValue(new Error('Connection failed'));

    const result = await toolHandler({ limit: 20 });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('Connection failed');
  });
});
