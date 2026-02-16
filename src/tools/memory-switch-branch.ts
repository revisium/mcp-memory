import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import type { Session } from '../session.js';

export function registerMemorySwitchBranch(
  server: McpServer,
  session: Session,
): void {
  server.registerTool(
    'memory_switch_branch',
    {
      title: 'Switch Branch',
      description:
        'Switch to a different branch. Subsequent operations will use this branch.',
      inputSchema: z.object({
        name: z.string().describe('Branch name to switch to (e.g. "master")'),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async ({ name }) => {
      try {
        session.switchBranch(name);
        await session.saveConfig();

        return {
          content: [
            {
              type: 'text' as const,
              text: `Switched to branch "${name}".`,
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
