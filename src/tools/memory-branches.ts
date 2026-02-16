import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import type { Session } from '../session.js';

export function registerMemoryBranches(
  server: McpServer,
  session: Session,
): void {
  server.registerTool(
    'memory_branches',
    {
      title: 'List Branches',
      description:
        'List all branches in the current project. Shows which branch is currently active.',
      inputSchema: z.object({}),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async () => {
      try {
        await session.connect();
        const config = session.getConfig();
        const project = session
          .getClient()
          .org(config.org!)
          .project(config.project);
        const branches = await project.getBranches({ first: 100 });

        const result = branches.edges.map((edge) => ({
          name: edge.node.name,
          active: edge.node.name === config.branch,
          isRoot: edge.node.isRoot,
          createdAt: edge.node.createdAt,
        }));

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
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
