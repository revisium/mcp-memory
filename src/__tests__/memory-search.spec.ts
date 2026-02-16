import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { Session } from '../session.js';
import { registerMemorySearch } from '../tools/memory-search.js';

describe('memory_search', () => {
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

  const mockHead = {
    getRows: mockGetRows,
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

    registerMemorySearch(server, session as Session);
  });

  it('should search a specific table', async () => {
    mockGetRows.mockResolvedValue({
      edges: [
        {
          node: {
            id: 'fact-1',
            data: { topic: 'test', content: 'hello' },
          },
        },
      ],
    });

    const result = await toolHandler({
      table: 'facts',
      limit: 20,
    });

    const parsed = JSON.parse(result.content[0]!.text) as unknown[];
    expect(parsed).toHaveLength(1);
    expect(mockGetRows).toHaveBeenCalledWith('facts', { first: 20 });
  });

  it('should search all tables when no table specified', async () => {
    mockGetRows.mockResolvedValue({ edges: [] });

    await toolHandler({ limit: 20 });

    expect(mockGetRows).toHaveBeenCalledTimes(3);
  });

  it('should filter by field and string value', async () => {
    mockGetRows.mockResolvedValue({ edges: [] });

    await toolHandler({
      table: 'facts',
      field: 'topic',
      value: 'typescript',
      limit: 20,
    });

    expect(mockGetRows).toHaveBeenCalledWith('facts', {
      first: 20,
      where: { data: { path: 'topic', string_contains: 'typescript' } },
    });
  });

  it('should filter by field and numeric value using equals', async () => {
    mockGetRows.mockResolvedValue({ edges: [] });

    await toolHandler({
      table: 'facts',
      field: 'confidence',
      value: 0.9,
      limit: 20,
    });

    expect(mockGetRows).toHaveBeenCalledWith('facts', {
      first: 20,
      where: { data: { path: 'confidence', equals: 0.9 } },
    });
  });

  it('should filter by field and boolean value using equals', async () => {
    mockGetRows.mockResolvedValue({ edges: [] });

    await toolHandler({
      table: 'facts',
      field: 'verified',
      value: true,
      limit: 20,
    });

    expect(mockGetRows).toHaveBeenCalledWith('facts', {
      first: 20,
      where: { data: { path: 'verified', equals: true } },
    });
  });

  it('should filter by query (row ID contains)', async () => {
    mockGetRows.mockResolvedValue({ edges: [] });

    await toolHandler({
      table: 'facts',
      query: 'nestjs',
      limit: 20,
    });

    expect(mockGetRows).toHaveBeenCalledWith('facts', {
      first: 20,
      where: { id: { contains: 'nestjs' } },
    });
  });

  it('should return "No results" when empty', async () => {
    mockGetRows.mockResolvedValue({ edges: [] });

    const result = await toolHandler({ table: 'facts', limit: 20 });

    expect(result.content[0]?.text).toBe('No results found.');
  });

  const makeEdges = (count: number, prefix: string) =>
    Array.from({ length: count }, (_, i) => ({
      node: { id: `${prefix}-${i}`, data: {} },
    }));

  it('should enforce global limit across tables', async () => {
    mockGetRows
      .mockResolvedValueOnce({ edges: makeEdges(2, 'facts') })
      .mockResolvedValueOnce({ edges: makeEdges(2, 'episodes') })
      .mockResolvedValueOnce({ edges: makeEdges(2, 'config') });

    const result = await toolHandler({ limit: 3 });
    const parsed = JSON.parse(result.content[0]!.text) as unknown[];

    expect(parsed.length).toBeLessThanOrEqual(3);
    expect(mockGetRows).toHaveBeenNthCalledWith(1, 'facts', { first: 3 });
    expect(mockGetRows).toHaveBeenNthCalledWith(2, 'episodes', { first: 1 });
  });

  it('should stop searching tables when limit reached', async () => {
    mockGetRows
      .mockResolvedValueOnce({ edges: makeEdges(5, 'facts') })
      .mockResolvedValue({ edges: [] });

    const result = await toolHandler({ limit: 5 });
    const parsed = JSON.parse(result.content[0]!.text) as unknown[];

    expect(parsed).toHaveLength(5);
  });

  it('should handle errors', async () => {
    session.getHead = jest
      .fn<() => Promise<unknown>>()
      .mockRejectedValue(new Error('Connection failed'));

    const result = await toolHandler({ table: 'facts', limit: 20 });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('Connection failed');
  });
});
