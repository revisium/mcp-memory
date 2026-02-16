import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { Session } from '../session.js';
import { registerMemoryUpdateSchema } from '../tools/memory-update-schema.js';

describe('memory_update_schema', () => {
  let server: McpServer;
  let session: any;
  let toolHandler: (params: Record<string, unknown>) => Promise<{
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
  }>;

  const mockCreateTable = jest.fn<() => Promise<unknown>>();
  const mockUpdateTable = jest.fn<() => Promise<unknown>>();
  const mockRenameTable = jest.fn<() => Promise<unknown>>();
  const mockDeleteTable = jest.fn<() => Promise<unknown>>();

  beforeEach(() => {
    jest.clearAllMocks();

    session = {
      getDraft: jest.fn<() => Promise<unknown>>().mockResolvedValue({
        createTable: mockCreateTable,
        updateTable: mockUpdateTable,
        renameTable: mockRenameTable,
        deleteTable: mockDeleteTable,
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

    registerMemoryUpdateSchema(server, session as Session);
  });

  describe('add_table', () => {
    it('should create a table with schema', async () => {
      mockCreateTable.mockResolvedValue({});

      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string', default: '' },
          rating: { type: 'number', default: 0 },
        },
        additionalProperties: false,
        required: ['name', 'rating'],
      };

      const result = await toolHandler({
        action: 'add_table',
        table: 'reviews',
        schema,
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0]!.text).toContain('reviews');
      expect(result.content[0]!.text).toContain('2 fields');
      expect(mockCreateTable).toHaveBeenCalledWith('reviews', schema);
    });

    it('should error when schema is missing', async () => {
      const result = await toolHandler({
        action: 'add_table',
        table: 'reviews',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0]!.text).toContain('schema');
    });
  });

  describe('update_table', () => {
    it('should apply patches to table schema', async () => {
      mockUpdateTable.mockResolvedValue({});

      const patches = [
        {
          op: 'add',
          path: '/properties/tags',
          value: { type: 'array', items: { type: 'string', default: '' } },
        },
        { op: 'add', path: '/required/-', value: 'tags' },
      ];

      const result = await toolHandler({
        action: 'update_table',
        table: 'contacts',
        patches,
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0]!.text).toContain('contacts');
      expect(result.content[0]!.text).toContain('2 patch');
      expect(mockUpdateTable).toHaveBeenCalledWith('contacts', patches);
    });

    it('should error when patches is missing', async () => {
      const result = await toolHandler({
        action: 'update_table',
        table: 'contacts',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0]!.text).toContain('patches');
    });
  });

  describe('rename_table', () => {
    it('should rename a table', async () => {
      mockRenameTable.mockResolvedValue({});

      const result = await toolHandler({
        action: 'rename_table',
        table: 'old-name',
        newName: 'new-name',
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0]!.text).toContain('old-name');
      expect(result.content[0]!.text).toContain('new-name');
      expect(mockRenameTable).toHaveBeenCalledWith('old-name', 'new-name');
    });

    it('should error when newName is missing', async () => {
      const result = await toolHandler({
        action: 'rename_table',
        table: 'old-name',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0]!.text).toContain('newName');
    });
  });

  describe('delete_table', () => {
    it('should delete a table', async () => {
      mockDeleteTable.mockResolvedValue({});

      const result = await toolHandler({
        action: 'delete_table',
        table: 'obsolete',
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0]!.text).toContain('obsolete');
      expect(result.content[0]!.text).toContain('deleted');
      expect(mockDeleteTable).toHaveBeenCalledWith('obsolete');
    });
  });

  it('should handle errors', async () => {
    session.getDraft.mockRejectedValue(new Error('Not connected'));

    const result = await toolHandler({
      action: 'delete_table',
      table: 'test',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain('Not connected');
  });
});
