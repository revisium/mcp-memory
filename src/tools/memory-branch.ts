import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import type { Session } from '../session.js';

export function registerMemoryBranch(
  server: McpServer,
  session: Session,
): void {
  server.registerTool(
    'memory_branch',
    {
      title: 'Create Branch',
      description:
        'Create a new branch from the current branch head. Like git branch — creates an independent line of changes.',
      inputSchema: z.object({
        name: z.string().describe('Branch name (e.g. "experiment-v2")'),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
      },
    },
    async ({ name }) => {
      try {
        const branch = await session.getBranchScope();
        const config = session.getConfig();
        const project = session
          .getClient()
          .org(config.org!)
          .project(config.project);

        const result = await project.createBranch(name, branch.headRevisionId);

        return {
          content: [
            {
              type: 'text' as const,
              text: `Branch "${result.name}" created from head revision. Use memory_switch_branch to switch to it.`,
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
