import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import type { Session, SessionConfig } from '../session.js';

function getAuthType(config: SessionConfig): string {
  if (config.token) {
    return 'token';
  }
  if (config.username) {
    return 'credentials';
  }
  return 'none';
}

export function registerMemoryStatus(
  server: McpServer,
  session: Session,
): void {
  server.registerTool(
    'memory_status',
    {
      title: 'Memory Status',
      description:
        'Show current connection status, active project/branch, and number of pending uncommitted changes.',
      inputSchema: z.object({}),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async () => {
      try {
        const config = session.getConfig();

        const status: Record<string, unknown> = {
          url: config.url,
          connected: session.isConnected(),
          org: config.org ?? '(will be resolved on connect)',
          project: config.project,
          branch: config.branch,
          auth: getAuthType(config),
        };

        try {
          const draft = await session.getDraft();
          const changes = await draft.getChanges();
          status['pendingChanges'] = changes.totalChanges;

          const tables = await draft.getTables({ first: 100 });
          status['tables'] = tables.edges.map((e) => e.node.id);
        } catch {
          status['pendingChanges'] = 'unable to fetch';
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(status, null, 2),
            },
          ],
        };
      } catch (error: unknown) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
