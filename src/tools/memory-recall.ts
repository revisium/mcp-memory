import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import type { Session } from '../session.js';

export function registerMemoryRecall(
  server: McpServer,
  session: Session,
): void {
  server.registerTool(
    'memory_recall',
    {
      title: 'Recall Memory',
      description:
        'Get a specific memory entry by table and ID. Returns the full row data.',
      inputSchema: z.object({
        table: z
          .string()
          .describe('Table to read from (e.g. "facts", "episodes", "config")'),
        id: z.string().describe('Row ID to retrieve'),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async ({ table, id }) => {
      try {
        const head = await session.getHead();
        const row = await head.getRow(table, id);

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  table,
                  id: row.id,
                  data: row.data,
                },
                null,
                2,
              ),
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
