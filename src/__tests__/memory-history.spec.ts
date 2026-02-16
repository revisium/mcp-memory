import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { Session } from '../session.js';
import { registerMemoryHistory } from '../tools/memory-history.js';

describe('memory_history', () => {
  let server: McpServer;
  let session: any;
  let toolHandler: (params: Record<string, unknown>) => Promise<{
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
  }>;

  const mockGetRevisions = jest.fn<
    () => Promise<{
      edges: Array<{
        node: {
          id: string;
          createdAt: string;
          isDraft: boolean;
          isHead: boolean;
        };
      }>;
    }>
  >();

  beforeEach(() => {
    jest.clearAllMocks();

    session = {
      getBranchScope: jest.fn<() => Promise<unknown>>().mockResolvedValue({
        getRevisions: mockGetRevisions,
      }),
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

    registerMemoryHistory(server, session as Session);
  });

  it('should show revision history', async () => {
    mockGetRevisions.mockResolvedValue({
      edges: [
        {
          node: {
            id: 'rev-1',
            createdAt: '2026-01-01T00:00:00Z',
            isDraft: true,
            isHead: false,
          },
        },
        {
          node: {
            id: 'rev-2',
            createdAt: '2026-01-01T00:00:00Z',
            isDraft: false,
            isHead: true,
          },
        },
      ],
    });

    const result = await toolHandler({ limit: 10 });
    const parsed = JSON.parse(result.content[0]!.text) as Array<{
      id: string;
    }>;

    expect(parsed).toHaveLength(2);
    expect(parsed[0]!.id).toBe('rev-1');
  });

  it('should return no revisions message', async () => {
    mockGetRevisions.mockResolvedValue({ edges: [] });

    const result = await toolHandler({ limit: 10 });

    expect(result.content[0]?.text).toBe('No revisions found.');
  });

  it('should handle errors', async () => {
    session.getBranchScope = jest
      .fn<() => Promise<unknown>>()
      .mockRejectedValue(new Error('Failed'));

    const result = await toolHandler({ limit: 10 });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('Failed');
  });
});
