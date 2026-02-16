import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import type { Session } from '../session.js';

export function registerMemoryDiff(server: McpServer, session: Session): void {
  server.registerTool(
    'memory_diff',
    {
      title: 'Show Changes',
      description:
        'Show pending (uncommitted) changes — like git diff. Returns a summary of table and row changes, plus row-level details.',
      inputSchema: z.object({
        table: z
          .string()
          .optional()
          .describe('Filter row changes to a specific table'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .default(20)
          .describe('Maximum row changes to return'),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async ({ table, limit }) => {
      try {
        const draft = await session.getDraft();
        const summary = await draft.getChanges();

        if (summary.totalChanges === 0) {
          return {
            content: [{ type: 'text' as const, text: 'No pending changes.' }],
          };
        }

        const rowChanges = await draft.getRowChanges({
          first: limit,
          ...(table ? { tableId: table } : {}),
        });

        const rows = rowChanges.edges.map((edge) => {
          const node = edge.node;
          const result: Record<string, unknown> = {
            changeType: node.changeType,
            table: node.table?.id ?? null,
            row: node.row?.id ?? node.fromRow?.id ?? null,
          };

          if (node.fieldChanges.length > 0) {
            result['fields'] = node.fieldChanges.map((fc) => ({
              field: fc.fieldPath,
              changeType: fc.changeType,
              ...(fc.oldValue !== undefined && fc.oldValue !== null
                ? { old: fc.oldValue }
                : {}),
              ...(fc.newValue !== undefined && fc.newValue !== null
                ? { new: fc.newValue }
                : {}),
            }));
          }

          return result;
        });

        const output = {
          totalChanges: summary.totalChanges,
          tables: summary.tablesSummary,
          rows: summary.rowsSummary,
          changes: rows,
        };

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(output, null, 2),
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
