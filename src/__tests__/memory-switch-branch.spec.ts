import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { Session } from '../session.js';
import { registerMemorySwitchBranch } from '../tools/memory-switch-branch.js';

describe('memory_switch_branch', () => {
  let server: McpServer;
  let session: any;
  let toolHandler: (params: Record<string, unknown>) => Promise<{
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
  }>;

  beforeEach(() => {
    jest.clearAllMocks();

    session = {
      switchBranch: jest.fn(),
      saveConfig: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
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

    registerMemorySwitchBranch(server, session as Session);
  });

  it('should switch branch', async () => {
    const result = await toolHandler({ name: 'experiment' });

    expect(result.content[0]?.text).toContain('experiment');
    expect(session.switchBranch).toHaveBeenCalledWith('experiment');
    expect(session.saveConfig).toHaveBeenCalled();
  });

  it('should handle errors', async () => {
    session.switchBranch = jest.fn().mockImplementation(() => {
      throw new Error('Switch failed');
    });

    const result = await toolHandler({ name: 'bad' });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('Switch failed');
  });
});
