import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import type { Session } from '../session.js';

export function registerMemoryProjects(
  server: McpServer,
  session: Session,
): void {
  server.registerTool(
    'memory_projects',
    {
      title: 'List Projects',
      description:
        'List all memory projects in the organization. Shows which project is currently active.',
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
        const org = session.getClient().org(config.org!);
        const projects = await org.getProjects({ first: 100 });

        const result = projects.edges.map((edge) => ({
          name: edge.node.name,
          active: edge.node.name === config.project,
          createdAt: edge.node.createdAt,
        }));

        return {
          content: [
            {
              type: 'text' as const,
              text:
                result.length > 0
                  ? JSON.stringify(result, null, 2)
                  : 'No projects found.',
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
