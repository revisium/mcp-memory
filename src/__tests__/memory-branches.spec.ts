import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { Session } from '../session.js';
import { registerMemoryBranches } from '../tools/memory-branches.js';

describe('memory_branches', () => {
  let server: McpServer;
  let session: any;
  let toolHandler: (params: Record<string, unknown>) => Promise<{
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
  }>;

  const mockGetBranches = jest.fn<
    () => Promise<{
      edges: Array<{
        node: {
          name: string;
          isRoot: boolean;
          createdAt: string;
        };
      }>;
    }>
  >();

  beforeEach(() => {
    jest.clearAllMocks();

    session = {
      connect: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      getConfig: jest
        .fn()
        .mockReturnValue({ org: 'admin', project: 'memory', branch: 'master' }),
      getClient: jest.fn().mockReturnValue({
        org: jest.fn().mockReturnValue({
          project: jest.fn().mockReturnValue({
            getBranches: mockGetBranches,
          }),
        }),
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

    registerMemoryBranches(server, session as Session);
  });

  it('should list branches', async () => {
    mockGetBranches.mockResolvedValue({
      edges: [
        {
          node: {
            name: 'master',
            isRoot: true,
            createdAt: '2026-01-01T00:00:00Z',
          },
        },
        {
          node: {
            name: 'experiment',
            isRoot: false,
            createdAt: '2026-01-02T00:00:00Z',
          },
        },
      ],
    });

    const result = await toolHandler({});
    const parsed = JSON.parse(result.content[0]!.text) as Array<{
      name: string;
      active: boolean;
    }>;

    expect(parsed).toHaveLength(2);
    expect(parsed[0]!.active).toBe(true);
    expect(parsed[1]!.active).toBe(false);
  });

  it('should handle errors', async () => {
    session.connect = jest
      .fn<() => Promise<void>>()
      .mockRejectedValue(new Error('Failed'));

    const result = await toolHandler({});

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('Failed');
  });
});
