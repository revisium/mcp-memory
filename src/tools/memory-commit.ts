import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import type { Session } from '../session.js';

export function registerMemoryCommit(
  server: McpServer,
  session: Session,
): void {
  server.registerTool(
    'memory_commit',
    {
      title: 'Commit Memory',
      description:
        'Commit all pending changes to create a new immutable revision. Like git commit — saves your current draft state.',
      inputSchema: z.object({
        message: z
          .string()
          .optional()
          .describe('Commit message describing what changed (optional)'),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
      },
    },
    async ({ message }) => {
      try {
        const draft = await session.getDraft();

        const changes = await draft.getChanges();
        if (changes.totalChanges === 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: 'No pending changes to commit.',
              },
            ],
          };
        }

        const revision = await draft.commit(message);

        return {
          content: [
            {
              type: 'text' as const,
              text: `Committed revision ${revision.id} (${changes.totalChanges} changes). Created at ${revision.createdAt}.`,
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
