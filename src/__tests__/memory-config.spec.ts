import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { Session } from '../session.js';
import { registerMemoryConfig } from '../tools/memory-config.js';

describe('memory_config', () => {
  let server: McpServer;
  let session: any;
  let toolHandler: (params: Record<string, unknown>) => Promise<{
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
  }>;

  const mockGetRows = jest.fn<
    () => Promise<{
      edges: Array<{
        node: { id: string; data: Record<string, unknown> };
      }>;
    }>
  >();
  const mockGetRow =
    jest.fn<() => Promise<{ data: Record<string, unknown> }>>();
  const mockCreateRow = jest.fn<() => Promise<{ row: { id: string } }>>();
  const mockUpdateRow = jest.fn<() => Promise<{ row: { id: string } }>>();

  const mockHead = { getRows: mockGetRows, getRow: mockGetRow };
  const mockDraft = { createRow: mockCreateRow, updateRow: mockUpdateRow };

  beforeEach(() => {
    jest.clearAllMocks();

    session = {
      getHead: jest.fn<() => Promise<unknown>>().mockResolvedValue(mockHead),
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

    registerMemoryConfig(server, session as Session);
  });

  it('should list config entries', async () => {
    mockGetRows.mockResolvedValue({
      edges: [
        {
          node: {
            id: 'auto-commit',
            data: { value: 'true', description: 'Auto-commit' },
          },
        },
      ],
    });

    const result = await toolHandler({ action: 'list' });
    const parsed = JSON.parse(result.content[0]!.text) as Array<{
      key: string;
    }>;

    expect(parsed).toHaveLength(1);
    expect(parsed[0]!.key).toBe('auto-commit');
  });

  it('should return message when no config entries', async () => {
    mockGetRows.mockResolvedValue({ edges: [] });

    const result = await toolHandler({ action: 'list' });

    expect(result.content[0]?.text).toBe('No config entries found.');
  });

  it('should get config by key', async () => {
    mockGetRow.mockResolvedValue({
      data: { value: 'true', description: 'desc' },
    });

    const result = await toolHandler({ action: 'get', key: 'auto-commit' });
    const parsed = JSON.parse(result.content[0]!.text) as Record<
      string,
      unknown
    >;

    expect(parsed['key']).toBe('auto-commit');
    expect(parsed['value']).toBe('true');
  });

  it('should return not found for missing key', async () => {
    mockGetRow.mockRejectedValue(new Error('Not found'));

    const result = await toolHandler({ action: 'get', key: 'missing' });

    expect(result.content[0]?.text).toContain('not found');
    expect(result.isError).toBeUndefined();
  });

  it('should require key for get action', async () => {
    const result = await toolHandler({ action: 'get' });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('"key" is required');
  });

  it('should set config', async () => {
    mockCreateRow.mockResolvedValue({ row: { id: 'my-key' } });

    const result = await toolHandler({
      action: 'set',
      key: 'my-key',
      value: 'my-value',
      description: 'A description',
    });

    expect(result.content[0]?.text).toContain('my-key');
    expect(result.content[0]?.text).toContain('my-value');
    expect(mockCreateRow).toHaveBeenCalledWith('config', 'my-key', {
      key: 'my-key',
      value: 'my-value',
      description: 'A description',
    });
  });

  it('should update config if create fails', async () => {
    mockCreateRow.mockRejectedValue(new Error('Row exists'));
    mockUpdateRow.mockResolvedValue({ row: { id: 'my-key' } });

    const result = await toolHandler({
      action: 'set',
      key: 'my-key',
      value: 'updated',
    });

    expect(result.content[0]?.text).toContain('my-key');
    expect(mockUpdateRow).toHaveBeenCalledWith('config', 'my-key', {
      key: 'my-key',
      value: 'updated',
      description: '',
    });
  });

  it('should require value for set action', async () => {
    const result = await toolHandler({ action: 'set', key: 'my-key' });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('"value" is required');
  });

  it('should require key for set action', async () => {
    const result = await toolHandler({ action: 'set', value: 'v' });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('"key" is required');
  });

  it('should handle errors', async () => {
    session.getHead = jest
      .fn<() => Promise<unknown>>()
      .mockRejectedValue(new Error('Connection failed'));

    const result = await toolHandler({ action: 'list' });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('Connection failed');
  });
});
