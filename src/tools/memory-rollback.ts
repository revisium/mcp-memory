import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import type { Session } from '../session.js';

export function registerMemoryRollback(
  server: McpServer,
  session: Session,
): void {
  server.registerTool(
    'memory_rollback',
    {
      title: 'Rollback Changes',
      description:
        'Discard all uncommitted changes, reverting draft to the last committed state. Like git checkout -- .',
      inputSchema: z.object({}),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
      },
    },
    async () => {
      try {
        const draft = await session.getDraft();
        await draft.revertChanges();

        return {
          content: [
            {
              type: 'text' as const,
              text: 'All uncommitted changes have been reverted.',
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
