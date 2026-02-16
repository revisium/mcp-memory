import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import type { Session } from '../session.js';

export function registerMemoryGetSchema(
  server: McpServer,
  session: Session,
): void {
  server.registerTool(
    'memory_get_schema',
    {
      title: 'Get Schema',
      description:
        'Get table schema(s) for the current project. Returns JSON Schema definition with field types, defaults, descriptions, foreignKeys, and other metadata. Use before memory_update_schema to understand current structure.',
      inputSchema: z.object({
        table: z
          .string()
          .optional()
          .describe('Table name. If omitted, returns schemas for all tables.'),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async ({ table }) => {
      try {
        const head = await session.getHead();

        if (table) {
          const schema = await head.getTableSchema(table);
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify({ table, schema }, null, 2),
              },
            ],
          };
        }

        const tablesResult = await head.getTables({ first: 100 });
        const schemas: Record<string, unknown> = {};

        for (const edge of tablesResult.edges) {
          const tableId = edge.node.id;
          schemas[tableId] = await head.getTableSchema(tableId);
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(schemas, null, 2),
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
