import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { RevisiumClient } from '@revisium/client';

import { Session } from '../session.js';
import { registerMemoryBranch } from '../tools/memory-branch.js';
import { registerMemoryBranches } from '../tools/memory-branches.js';
import { registerMemoryCommit } from '../tools/memory-commit.js';
import { registerMemoryConfig } from '../tools/memory-config.js';
import { registerMemoryCreateProject } from '../tools/memory-create-project.js';
import { registerMemoryHistory } from '../tools/memory-history.js';
import { registerMemoryProjects } from '../tools/memory-projects.js';
import { registerMemorySearch } from '../tools/memory-search.js';
import { registerMemoryStatus } from '../tools/memory-status.js';
import { registerMemoryStore } from '../tools/memory-store.js';
import { registerMemorySwitchBranch } from '../tools/memory-switch-branch.js';
import { registerMemorySwitchProject } from '../tools/memory-switch-project.js';

const REVISIUM_URL = process.env['REVISIUM_URL'] ?? 'http://localhost:9000';
const TEST_PROJECT = `test-mcp-memory-${Date.now()}`;

type ToolResult = {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
};

type ToolHandler = (params: Record<string, unknown>) => Promise<ToolResult>;

describe('mcp-memory integration', () => {
  const tools = new Map<string, ToolHandler>();
  let client: RevisiumClient;
  let session: Session;

  function captureTools(server: McpServer): void {
    const original = server.registerTool.bind(server);
    server.registerTool = ((
      name: string,
      config: any,
      handler: ToolHandler,
    ) => {
      tools.set(name, handler);
      return original(name, config, handler as any);
    }) as typeof server.registerTool;
  }

  function callTool(
    name: string,
    params: Record<string, unknown> = {},
  ): Promise<ToolResult> {
    const handler = tools.get(name);
    if (!handler) {
      throw new Error(`Tool "${name}" not registered`);
    }
    return handler(params);
  }

  function getText(result: ToolResult): string {
    return result.content[0]?.text ?? '';
  }

  function parseJson(result: ToolResult): unknown {
    return JSON.parse(getText(result));
  }

  beforeAll(async () => {
    client = new RevisiumClient({ baseUrl: REVISIUM_URL });
    await client.login('admin', 'admin');

    const me = await client.me();
    expect(me.id).toBeDefined();

    session = new Session({
      url: REVISIUM_URL,
      username: 'admin',
      password: 'admin',
      org: 'admin',
      project: TEST_PROJECT,
      branch: 'master',
    });

    const server = new McpServer({
      name: 'test',
      version: '0.1.0',
    });
    captureTools(server);

    registerMemoryStore(server, session);
    registerMemorySearch(server, session);
    registerMemoryConfig(server, session);
    registerMemoryCommit(server, session);
    registerMemoryStatus(server, session);
    registerMemoryProjects(server, session);
    registerMemoryCreateProject(server, session);
    registerMemorySwitchProject(server, session);
    registerMemoryBranch(server, session);
    registerMemorySwitchBranch(server, session);
    registerMemoryBranches(server, session);
    registerMemoryHistory(server, session);
  });

  afterAll(async () => {
    try {
      const project = client.org('admin').project(TEST_PROJECT);
      await project.delete();
    } catch {
      // ignore cleanup errors
    }
    try {
      const project = client
        .org('admin')
        .project(`${TEST_PROJECT}-branch-test`);
      await project.delete();
    } catch {
      // ignore cleanup errors
    }
  });

  describe('Level 1 — Core tools', () => {
    it('should show status before any operation', async () => {
      const result = await callTool('memory_status');
      expect(result.isError).toBeUndefined();

      const status = parseJson(result) as Record<string, unknown>;
      expect(status['url']).toBe(REVISIUM_URL);
      expect(status['project']).toBe(TEST_PROJECT);
      expect(status['branch']).toBe('master');
    });

    it('should auto-create project on first store', async () => {
      const result = await callTool('memory_store', {
        table: 'facts',
        id: 'nestjs-framework',
        data: {
          topic: 'architecture',
          content: 'Project uses NestJS with CQRS pattern',
          confidence: 0.95,
          source: 'code review',
          category: 'technical',
        },
      });

      expect(result.isError).toBeUndefined();
      expect(getText(result)).toContain('created');
    });

    it('should store another fact', async () => {
      const result = await callTool('memory_store', {
        table: 'facts',
        id: 'prisma-orm',
        data: {
          topic: 'database',
          content: 'PostgreSQL with Prisma ORM',
          confidence: 0.9,
          source: 'package.json',
          category: 'technical',
        },
      });

      expect(result.isError).toBeUndefined();
      expect(getText(result)).toContain('created');
    });

    it('should store an episode', async () => {
      const result = await callTool('memory_store', {
        table: 'episodes',
        id: 'ep-001',
        data: {
          action: 'analyzed codebase',
          outcome: 'identified NestJS + Prisma stack',
          timestamp: new Date().toISOString(),
          context: 'initial exploration',
          importance: 0.8,
        },
      });

      expect(result.isError).toBeUndefined();
      expect(getText(result)).toContain('created');
    });

    it('should commit changes', async () => {
      const result = await callTool('memory_commit', {
        message: 'Initial memory entries',
      });

      expect(result.isError).toBeUndefined();
      expect(getText(result)).toContain('Committed revision');
      expect(getText(result)).toContain('changes');
    });

    it('should report no changes after commit', async () => {
      const result = await callTool('memory_commit', {
        message: 'Should be empty',
      });

      expect(result.isError).toBeUndefined();
      expect(getText(result)).toContain('No pending changes');
    });

    it('should search facts table', async () => {
      const result = await callTool('memory_search', {
        table: 'facts',
        limit: 20,
      });

      expect(result.isError).toBeUndefined();
      const rows = parseJson(result) as Array<{
        table: string;
        id: string;
      }>;
      expect(rows.length).toBeGreaterThanOrEqual(2);
      expect(rows.some((r) => r.id === 'nestjs-framework')).toBe(true);
      expect(rows.some((r) => r.id === 'prisma-orm')).toBe(true);
    });

    it('should search by row ID query', async () => {
      const result = await callTool('memory_search', {
        table: 'facts',
        query: 'nestjs',
        limit: 20,
      });

      expect(result.isError).toBeUndefined();
      const rows = parseJson(result) as Array<{ id: string }>;
      expect(rows.length).toBe(1);
      expect(rows[0]!.id).toBe('nestjs-framework');
    });

    it('should search by field filter', async () => {
      const result = await callTool('memory_search', {
        table: 'facts',
        field: 'topic',
        value: 'database',
        limit: 20,
      });

      expect(result.isError).toBeUndefined();
      const rows = parseJson(result) as Array<{ id: string }>;
      expect(rows.length).toBe(1);
      expect(rows[0]!.id).toBe('prisma-orm');
    });

    it('should search across all tables', async () => {
      const result = await callTool('memory_search', {
        limit: 50,
      });

      expect(result.isError).toBeUndefined();
      const rows = parseJson(result) as Array<{
        table: string;
        id: string;
      }>;
      expect(rows.length).toBeGreaterThanOrEqual(3);
      const tables = new Set(rows.map((r) => r.table));
      expect(tables.has('facts')).toBe(true);
      expect(tables.has('episodes')).toBe(true);
    });

    it('should return no results for non-matching search', async () => {
      const result = await callTool('memory_search', {
        table: 'facts',
        query: 'nonexistent-xyz-123',
        limit: 20,
      });

      expect(result.isError).toBeUndefined();
      expect(getText(result)).toBe('No results found.');
    });

    it('should update existing row', async () => {
      const result = await callTool('memory_store', {
        table: 'facts',
        id: 'nestjs-framework',
        data: {
          topic: 'architecture',
          content: 'Project uses NestJS with CQRS pattern and event sourcing',
          confidence: 0.99,
          source: 'deep analysis',
          category: 'technical',
        },
      });

      expect(result.isError).toBeUndefined();
      expect(getText(result)).toContain('updated');
    });

    it('should set config', async () => {
      const result = await callTool('memory_config', {
        action: 'set',
        key: 'auto-commit',
        value: 'true',
        description: 'Auto-commit after store',
      });

      expect(result.isError).toBeUndefined();
      expect(getText(result)).toContain('auto-commit');
    });

    it('should get config', async () => {
      await callTool('memory_commit', {
        message: 'Add config entry',
      });

      const result = await callTool('memory_config', {
        action: 'get',
        key: 'auto-commit',
      });

      expect(result.isError).toBeUndefined();
      const data = parseJson(result) as Record<string, unknown>;
      expect(data['value']).toBe('true');
    });

    it('should list configs', async () => {
      const result = await callTool('memory_config', {
        action: 'list',
      });

      expect(result.isError).toBeUndefined();
      const entries = parseJson(result) as Array<{
        key: string;
      }>;
      expect(entries.length).toBeGreaterThanOrEqual(1);
      expect(entries.some((e) => e.key === 'auto-commit')).toBe(true);
    });

    it('should show status with tables and pending changes', async () => {
      const result = await callTool('memory_status');
      expect(result.isError).toBeUndefined();

      const status = parseJson(result) as Record<string, unknown>;
      expect(status['connected']).toBe(true);
      expect(status['auth']).toBe('credentials');
      expect(status['tables']).toBeDefined();
      const tables = status['tables'] as string[];
      expect(tables).toContain('facts');
      expect(tables).toContain('episodes');
      expect(tables).toContain('config');
    });
  });

  describe('Level 2 — Multi-project tools', () => {
    it('should list projects', async () => {
      const result = await callTool('memory_projects');
      expect(result.isError).toBeUndefined();

      const projects = parseJson(result) as Array<{
        name: string;
        active: boolean;
      }>;
      expect(projects.some((p) => p.name === TEST_PROJECT)).toBe(true);
      const active = projects.find((p) => p.name === TEST_PROJECT);
      expect(active?.active).toBe(true);
    });

    it('should switch project and switch back', async () => {
      const switchResult = await callTool('memory_switch_project', {
        name: 'nonexistent-project',
      });
      expect(switchResult.isError).toBeUndefined();
      expect(getText(switchResult)).toContain('nonexistent-project');

      const backResult = await callTool('memory_switch_project', {
        name: TEST_PROJECT,
      });
      expect(backResult.isError).toBeUndefined();

      const statusResult = await callTool('memory_status');
      const status = parseJson(statusResult) as Record<string, unknown>;
      expect(status['project']).toBe(TEST_PROJECT);
    });
  });

  describe('Level 3 — Branching tools', () => {
    it('should list branches', async () => {
      const result = await callTool('memory_branches');
      expect(result.isError).toBeUndefined();

      const branches = parseJson(result) as Array<{
        name: string;
        active: boolean;
        isRoot: boolean;
      }>;
      expect(branches.some((b) => b.name === 'master')).toBe(true);
      const master = branches.find((b) => b.name === 'master');
      expect(master?.active).toBe(true);
      expect(master?.isRoot).toBe(true);
    });

    it('should create a branch', async () => {
      const result = await callTool('memory_branch', {
        name: 'experiment',
      });

      expect(result.isError).toBeUndefined();
      expect(getText(result)).toContain('experiment');
      expect(getText(result)).toContain('created');
    });

    it('should switch to new branch', async () => {
      const result = await callTool('memory_switch_branch', {
        name: 'experiment',
      });

      expect(result.isError).toBeUndefined();
      expect(getText(result)).toContain('experiment');
    });

    it('should store and commit on branch', async () => {
      const storeResult = await callTool('memory_store', {
        table: 'facts',
        id: 'branch-fact',
        data: {
          topic: 'experiment',
          content: 'This fact only exists on experiment branch',
          confidence: 0.5,
          source: 'test',
          category: 'technical',
        },
      });
      expect(storeResult.isError).toBeUndefined();

      const commitResult = await callTool('memory_commit', {
        message: 'Branch-specific fact',
      });
      expect(commitResult.isError).toBeUndefined();
      expect(getText(commitResult)).toContain('Committed revision');
    });

    it('should switch back to master', async () => {
      const result = await callTool('memory_switch_branch', {
        name: 'master',
      });

      expect(result.isError).toBeUndefined();
    });

    it('should not find branch-specific fact on master', async () => {
      const result = await callTool('memory_search', {
        table: 'facts',
        query: 'branch-fact',
        limit: 20,
      });

      expect(result.isError).toBeUndefined();
      expect(getText(result)).toBe('No results found.');
    });

    it('should show revision history', async () => {
      const result = await callTool('memory_history', {
        limit: 10,
      });

      expect(result.isError).toBeUndefined();
      const revisions = parseJson(result) as Array<{
        id: string;
        isDraft: boolean;
        isHead: boolean;
      }>;
      expect(revisions.length).toBeGreaterThanOrEqual(3);

      const draft = revisions.find((r) => r.isDraft);
      expect(draft).toBeDefined();

      const head = revisions.find((r) => r.isHead);
      expect(head).toBeDefined();
    });

    it('should list branches including experiment', async () => {
      const result = await callTool('memory_branches');
      expect(result.isError).toBeUndefined();

      const branches = parseJson(result) as Array<{
        name: string;
        active: boolean;
      }>;
      expect(branches.length).toBeGreaterThanOrEqual(2);
      expect(branches.some((b) => b.name === 'experiment')).toBe(true);
      const master = branches.find((b) => b.name === 'master');
      expect(master?.active).toBe(true);
    });
  });
});
