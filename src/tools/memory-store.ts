import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import type { Session } from '../session.js';

function isRowExistsError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const msg = error.message.toLowerCase();
  return msg.includes('already exist') || msg.includes('duplicate');
}

export function registerMemoryStore(server: McpServer, session: Session): void {
  server.registerTool(
    'memory_store',
    {
      title: 'Store Memory',
      description:
        'Store a fact, episode, or config entry to memory. Creates or updates a row in the specified table. On first use, automatically creates the project and tables from the agent-memory template.',
      inputSchema: z.object({
        table: z
          .string()
          .describe('Table to store in (e.g. "facts", "episodes", "config")'),
        id: z
          .string()
          .describe(
            'Unique row ID — use a descriptive slug (e.g. "project-uses-nestjs")',
          ),
        data: z
          .record(z.unknown())
          .describe('Row data matching the table schema'),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async ({ table, id, data }) => {
      try {
        const draft = await session.getDraft();
        let operation: string;

        try {
          await draft.createRow(table, id, data);
          operation = 'created';
        } catch (createError: unknown) {
          if (!isRowExistsError(createError)) {
            throw createError;
          }
          await draft.updateRow(table, id, data);
          operation = 'updated';
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: `Row "${id}" ${operation} in table "${table}". Use memory_commit to persist changes.`,
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
