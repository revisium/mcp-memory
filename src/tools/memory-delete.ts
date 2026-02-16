import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import type { Session } from '../session.js';

export function registerMemoryDelete(
  server: McpServer,
  session: Session,
): void {
  server.registerTool(
    'memory_delete',
    {
      title: 'Delete Memory',
      description:
        'Delete a memory entry by table and ID. Use memory_commit to persist the deletion.',
      inputSchema: z.object({
        table: z
          .string()
          .describe(
            'Table to delete from (e.g. "facts", "episodes", "config")',
          ),
        id: z.string().describe('Row ID to delete'),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
      },
    },
    async ({ table, id }) => {
      try {
        const draft = await session.getDraft();
        await draft.deleteRow(table, id);

        let message = `Row "${id}" deleted from table "${table}".`;

        if (session.getConfig().autoCommit) {
          await draft.commit(`Delete ${table}/${id}`);
          message += ' (auto-committed)';
        } else {
          message += ' Use memory_commit to persist changes.';
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: message,
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
