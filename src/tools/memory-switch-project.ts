import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import type { Session } from '../session.js';

export function registerMemorySwitchProject(
  server: McpServer,
  session: Session,
): void {
  server.registerTool(
    'memory_switch_project',
    {
      title: 'Switch Project',
      description:
        'Switch to a different memory project. Subsequent operations will use this project.',
      inputSchema: z.object({
        name: z.string().describe('Project name to switch to'),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async ({ name }) => {
      try {
        session.switchProject(name);
        await session.saveConfig();

        return {
          content: [
            {
              type: 'text' as const,
              text: `Switched to project "${name}" on branch "master".`,
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
