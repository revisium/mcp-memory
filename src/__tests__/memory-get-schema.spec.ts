import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { Session } from '../session.js';
import { registerMemoryGetSchema } from '../tools/memory-get-schema.js';

describe('memory_get_schema', () => {
  let server: McpServer;
  let session: any;
  let toolHandler: (params: Record<string, unknown>) => Promise<{
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
  }>;

  const mockGetTableSchema = jest.fn<() => Promise<unknown>>();
  const mockGetTables = jest.fn<() => Promise<unknown>>();

  beforeEach(() => {
    jest.clearAllMocks();

    session = {
      getHead: jest.fn<() => Promise<unknown>>().mockResolvedValue({
        getTableSchema: mockGetTableSchema,
        getTables: mockGetTables,
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

    registerMemoryGetSchema(server, session as Session);
  });

  it('should return schema for a specific table', async () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string', default: '' },
        age: { type: 'number', default: 0 },
      },
      additionalProperties: false,
      required: ['name', 'age'],
    };
    mockGetTableSchema.mockResolvedValue(schema);

    const result = await toolHandler({ table: 'contacts' });

    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0]!.text) as {
      table: string;
      schema: unknown;
    };
    expect(parsed.table).toBe('contacts');
    expect(parsed.schema).toEqual(schema);
    expect(mockGetTableSchema).toHaveBeenCalledWith('contacts');
  });

  it('should return schemas for all tables when no table specified', async () => {
    mockGetTables.mockResolvedValue({
      edges: [{ node: { id: 'facts' } }, { node: { id: 'episodes' } }],
    });
    mockGetTableSchema
      .mockResolvedValueOnce({
        type: 'object',
        properties: { topic: { type: 'string', default: '' } },
      })
      .mockResolvedValueOnce({
        type: 'object',
        properties: { event: { type: 'string', default: '' } },
      });

    const result = await toolHandler({});

    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0]!.text) as Record<
      string,
      unknown
    >;
    expect(parsed.facts).toBeDefined();
    expect(parsed.episodes).toBeDefined();
    expect(mockGetTables).toHaveBeenCalledWith({ first: 100 });
  });

  it('should handle errors', async () => {
    session.getHead.mockRejectedValue(new Error('Not connected'));

    const result = await toolHandler({ table: 'facts' });

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain('Not connected');
  });
});
