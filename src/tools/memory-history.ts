import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import type { Session } from '../session.js';

export function registerMemoryHistory(
  server: McpServer,
  session: Session,
): void {
  server.registerTool(
    'memory_history',
    {
      title: 'Revision History',
      description:
        'Show revision history for the current branch with change summaries. Like git log.',
      inputSchema: z.object({
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .default(10)
          .describe('Number of revisions to show'),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async ({ limit }) => {
      try {
        const branch = await session.getBranchScope();
        const revisions = await branch.getRevisions({ first: limit });

        const result = revisions.edges.map((edge) => ({
          id: edge.node.id,
          createdAt: edge.node.createdAt,
          isDraft: edge.node.isDraft,
          isHead: edge.node.isHead,
        }));

        return {
          content: [
            {
              type: 'text' as const,
              text:
                result.length > 0
                  ? JSON.stringify(result, null, 2)
                  : 'No revisions found.',
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
