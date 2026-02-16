import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { Session } from '../session.js';
import { registerMemoryCreateProject } from '../tools/memory-create-project.js';

describe('memory_create_project', () => {
  let server: McpServer;
  let session: any;
  let toolHandler: (params: Record<string, unknown>) => Promise<{
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
  }>;

  const mockCreateProject = jest.fn<() => Promise<unknown>>();
  const mockCreateTable = jest.fn<() => Promise<unknown>>();
  const mockCommit = jest.fn<() => Promise<unknown>>();
  const mockDraft = {
    createTable: mockCreateTable,
    commit: mockCommit,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    session = {
      connect: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      getConfig: jest.fn().mockReturnValue({ org: 'admin', project: 'memory' }),
      getClient: jest.fn().mockReturnValue({
        org: jest.fn().mockReturnValue({
          createProject: mockCreateProject,
        }),
        revision: jest
          .fn<() => Promise<unknown>>()
          .mockResolvedValue(mockDraft),
      }),
      switchProject: jest.fn(),
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

    registerMemoryCreateProject(server, session as Session);
  });

  it('should create project with default template', async () => {
    mockCreateProject.mockResolvedValue({});
    mockCreateTable.mockResolvedValue({});
    mockCommit.mockResolvedValue({});

    const result = await toolHandler({ name: 'my-project' });

    expect(result.content[0]?.text).toContain('my-project');
    expect(result.content[0]?.text).toContain('created');
    expect(result.content[0]?.text).toContain('agent-memory');
    expect(mockCreateProject).toHaveBeenCalledWith({
      projectName: 'my-project',
      branchName: 'master',
    });
    expect(session.switchProject).toHaveBeenCalledWith('my-project');
    expect(session.saveConfig).toHaveBeenCalled();
  });

  it('should create project with specified template', async () => {
    mockCreateProject.mockResolvedValue({});
    mockCreateTable.mockResolvedValue({});
    mockCommit.mockResolvedValue({});

    const result = await toolHandler({
      name: 'contacts-project',
      template: 'contacts',
    });

    expect(result.content[0]?.text).toContain('contacts');
  });

  it('should reject unknown template', async () => {
    const result = await toolHandler({
      name: 'my-project',
      template: 'nonexistent',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('Unknown template');
    expect(result.content[0]?.text).toContain('nonexistent');
    expect(mockCreateProject).not.toHaveBeenCalled();
  });

  it('should create project with custom tables', async () => {
    mockCreateProject.mockResolvedValue({});
    mockCreateTable.mockResolvedValue({});
    mockCommit.mockResolvedValue({});

    const customTables = {
      wines: {
        type: 'object',
        properties: {
          name: { type: 'string', default: '' },
          year: { type: 'number', default: 0 },
        },
        additionalProperties: false,
        required: ['name', 'year'],
      },
    };

    const result = await toolHandler({
      name: 'wine-collection',
      tables: customTables,
    });

    expect(result.content[0]?.text).toContain('wine-collection');
    expect(result.content[0]?.text).toContain('custom schema');
    expect(result.content[0]?.text).toContain('wines');
    expect(mockCreateTable).toHaveBeenCalledWith('wines', customTables.wines);
    expect(mockCommit).toHaveBeenCalledWith('Initialize with custom schema');
  });

  it('should prefer custom tables over template', async () => {
    mockCreateProject.mockResolvedValue({});
    mockCreateTable.mockResolvedValue({});
    mockCommit.mockResolvedValue({});

    const customTables = {
      items: {
        type: 'object',
        properties: { name: { type: 'string', default: '' } },
        additionalProperties: false,
        required: ['name'],
      },
    };

    const result = await toolHandler({
      name: 'my-project',
      template: 'contacts',
      tables: customTables,
    });

    expect(result.content[0]?.text).toContain('custom schema');
    expect(mockCreateTable).toHaveBeenCalledTimes(1);
    expect(mockCreateTable).toHaveBeenCalledWith('items', customTables.items);
  });

  it('should handle errors', async () => {
    mockCreateProject.mockRejectedValue(new Error('Already exists'));

    const result = await toolHandler({ name: 'existing' });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('Already exists');
  });
});
