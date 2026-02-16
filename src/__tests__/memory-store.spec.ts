import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { Session } from '../session.js';
import { registerMemoryStore } from '../tools/memory-store.js';

describe('memory_store', () => {
  let server: McpServer;
  let session: any;
  let toolHandler: (params: Record<string, unknown>) => Promise<{
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
  }>;

  const mockCreateRow = jest.fn<() => Promise<{ row: { id: string } }>>();
  const mockUpdateRow = jest.fn<() => Promise<{ row: { id: string } }>>();
  const mockCommit =
    jest.fn<() => Promise<{ id: string; createdAt: string }>>();
  const mockDraft = {
    createRow: mockCreateRow,
    updateRow: mockUpdateRow,
    commit: mockCommit,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    session = {
      getDraft: jest.fn<() => Promise<unknown>>().mockResolvedValue(mockDraft),
      getConfig: jest.fn().mockReturnValue({ autoCommit: false }),
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

    registerMemoryStore(server, session as Session);
  });

  it('should create a new row', async () => {
    mockCreateRow.mockResolvedValue({ row: { id: 'test-fact' } });

    const result = await toolHandler({
      table: 'facts',
      id: 'test-fact',
      data: { topic: 'test', content: 'hello' },
    });

    expect(result.content[0]?.text).toContain('created');
    expect(mockCreateRow).toHaveBeenCalledWith('facts', 'test-fact', {
      topic: 'test',
      content: 'hello',
    });
  });

  it('should update existing row if create fails', async () => {
    mockCreateRow.mockRejectedValue(new Error('Row already exists'));
    mockUpdateRow.mockResolvedValue({ row: { id: 'test-fact' } });

    const result = await toolHandler({
      table: 'facts',
      id: 'test-fact',
      data: { topic: 'test', content: 'updated' },
    });

    expect(result.content[0]?.text).toContain('updated');
    expect(mockUpdateRow).toHaveBeenCalledWith('facts', 'test-fact', {
      topic: 'test',
      content: 'updated',
    });
  });

  it('should rethrow non-exists errors from createRow', async () => {
    mockCreateRow.mockRejectedValue(new Error('Permission denied'));

    const result = await toolHandler({
      table: 'facts',
      id: 'test',
      data: {},
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('Permission denied');
    expect(mockUpdateRow).not.toHaveBeenCalled();
  });

  it('should auto-commit when autoCommit is enabled', async () => {
    session.getConfig.mockReturnValue({ autoCommit: true });
    mockCreateRow.mockResolvedValue({ row: { id: 'test-fact' } });
    mockCommit.mockResolvedValue({
      id: 'rev-1',
      createdAt: '2026-01-01',
    });

    const result = await toolHandler({
      table: 'facts',
      id: 'test-fact',
      data: { topic: 'test' },
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0]?.text).toContain('auto-committed');
    expect(result.content[0]?.text).not.toContain('memory_commit');
    expect(mockCommit).toHaveBeenCalledWith('Store facts/test-fact');
  });

  it('should not auto-commit when autoCommit is disabled', async () => {
    mockCreateRow.mockResolvedValue({ row: { id: 'test-fact' } });

    const result = await toolHandler({
      table: 'facts',
      id: 'test-fact',
      data: { topic: 'test' },
    });

    expect(result.content[0]?.text).toContain('memory_commit');
    expect(result.content[0]?.text).not.toContain('auto-committed');
    expect(mockCommit).not.toHaveBeenCalled();
  });

  it('should return error on failure', async () => {
    session.getDraft = jest
      .fn<() => Promise<unknown>>()
      .mockRejectedValue(new Error('Connection failed'));

    const result = await toolHandler({
      table: 'facts',
      id: 'test',
      data: {},
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('Connection failed');
  });
});
