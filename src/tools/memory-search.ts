import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import type { Session } from '../session.js';

interface WhereClause {
  id?: { contains: string };
  data?: { path: string; string_contains?: string; equals?: unknown };
}

function buildWhere(
  query: string | undefined,
  field: string | undefined,
  value: unknown,
): WhereClause | undefined {
  let where: WhereClause | undefined;

  if (query) {
    where = { ...where, id: { contains: query } };
  }
  if (field && value !== undefined) {
    if (typeof value === 'string') {
      where = { ...where, data: { path: field, string_contains: value } };
    } else {
      where = { ...where, data: { path: field, equals: value } };
    }
  }

  return where;
}

export function registerMemorySearch(
  server: McpServer,
  session: Session,
): void {
  server.registerTool(
    'memory_search',
    {
      title: 'Search Memory',
      description:
        'Search memory entries by table, with optional filtering by field value and text search across row IDs.',
      inputSchema: z.object({
        table: z
          .string()
          .optional()
          .describe(
            'Table to search (e.g. "facts", "episodes", "config"). If omitted, searches all tables.',
          ),
        query: z.string().optional().describe('Text to search for in row IDs'),
        field: z
          .string()
          .optional()
          .describe('Field name to filter by (e.g. "topic", "category")'),
        value: z
          .union([z.string(), z.number(), z.boolean()])
          .optional()
          .describe('Field value to match'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .default(20)
          .describe('Maximum results to return'),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async ({ table, query, field, value, limit }) => {
      try {
        const head = await session.getHead();
        const tablesToSearch = table
          ? [table]
          : ['facts', 'episodes', 'config'];
        const where = buildWhere(query, field, value);

        const results: Array<{
          table: string;
          id: string;
          data: Record<string, unknown>;
        }> = [];

        for (const tableName of tablesToSearch) {
          const remaining = limit - results.length;
          if (remaining <= 0) {
            break;
          }

          try {
            const options = {
              first: remaining,
              ...(where ? { where } : {}),
            };
            const rows = await head.getRows(
              tableName,
              options as Parameters<typeof head.getRows>[1],
            );

            for (const edge of rows.edges.slice(0, remaining)) {
              results.push({
                table: tableName,
                id: edge.node.id,
                data: edge.node.data as Record<string, unknown>,
              });
            }
          } catch {
            // table might not exist, skip
          }
        }

        if (results.length === 0) {
          return {
            content: [{ type: 'text' as const, text: 'No results found.' }],
          };
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(results, null, 2),
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
