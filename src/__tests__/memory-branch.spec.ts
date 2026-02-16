import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { Session } from '../session.js';
import { registerMemoryBranch } from '../tools/memory-branch.js';

describe('memory_branch', () => {
  let server: McpServer;
  let session: any;
  let toolHandler: (params: Record<string, unknown>) => Promise<{
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
  }>;

  const mockCreateBranch = jest.fn<() => Promise<{ name: string }>>();

  beforeEach(() => {
    jest.clearAllMocks();

    session = {
      getBranchScope: jest.fn<() => Promise<unknown>>().mockResolvedValue({
        headRevisionId: 'rev-123',
      }),
      getConfig: jest
        .fn()
        .mockReturnValue({ org: 'admin', project: 'memory', branch: 'master' }),
      getClient: jest.fn().mockReturnValue({
        org: jest.fn().mockReturnValue({
          project: jest.fn().mockReturnValue({
            createBranch: mockCreateBranch,
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

    registerMemoryBranch(server, session as Session);
  });

  it('should create a branch', async () => {
    mockCreateBranch.mockResolvedValue({ name: 'experiment' });

    const result = await toolHandler({ name: 'experiment' });

    expect(result.content[0]?.text).toContain('experiment');
    expect(result.content[0]?.text).toContain('created');
    expect(mockCreateBranch).toHaveBeenCalledWith('experiment', 'rev-123');
  });

  it('should handle errors', async () => {
    session.getBranchScope = jest
      .fn<() => Promise<unknown>>()
      .mockRejectedValue(new Error('Not found'));

    const result = await toolHandler({ name: 'bad-branch' });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('Not found');
  });
});
