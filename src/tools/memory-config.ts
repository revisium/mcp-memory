import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import type { Session } from '../session.js';

export function registerMemoryConfig(
  server: McpServer,
  session: Session,
): void {
  server.registerTool(
    'memory_config',
    {
      title: 'Memory Config',
      description:
        'Get or set agent configuration stored in the "config" table. Use action "get" to read a config entry, "set" to write one, or "list" to see all config entries.',
      inputSchema: z.object({
        action: z.enum(['get', 'set', 'list']).describe('Action to perform'),
        key: z
          .string()
          .optional()
          .describe('Config key (required for get/set)'),
        value: z
          .string()
          .optional()
          .describe('Config value (required for set)'),
        description: z
          .string()
          .optional()
          .describe('Description of the config entry (optional for set)'),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async ({ action, key, value, description }) => {
      try {
        if (action === 'list') {
          const head = await session.getHead();
          const rows = await head.getRows('config', { first: 100 });
          const entries = rows.edges.map((edge) => ({
            key: edge.node.id,
            ...(edge.node.data as Record<string, unknown>),
          }));

          return {
            content: [
              {
                type: 'text' as const,
                text:
                  entries.length > 0
                    ? JSON.stringify(entries, null, 2)
                    : 'No config entries found.',
              },
            ],
          };
        }

        if (!key) {
          return {
            content: [
              {
                type: 'text' as const,
                text: 'Error: "key" is required for get/set actions.',
              },
            ],
            isError: true,
          };
        }

        if (action === 'get') {
          const head = await session.getHead();
          try {
            const row = await head.getRow('config', key);
            return {
              content: [
                {
                  type: 'text' as const,
                  text: JSON.stringify(
                    { key, ...(row.data as Record<string, unknown>) },
                    null,
                    2,
                  ),
                },
              ],
            };
          } catch {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: `Config key "${key}" not found.`,
                },
              ],
            };
          }
        }

        // action === 'set'
        if (value === undefined) {
          return {
            content: [
              {
                type: 'text' as const,
                text: 'Error: "value" is required for set action.',
              },
            ],
            isError: true,
          };
        }

        const draft = await session.getDraft();
        const data = {
          key,
          value,
          description: description ?? '',
        };

        try {
          await draft.createRow('config', key, data);
        } catch {
          await draft.updateRow('config', key, data);
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: `Config "${key}" set to "${value}". Use memory_commit to persist.`,
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
