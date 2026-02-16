import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import type { Session } from '../session.js';
import { getTemplate, templateNames } from '../templates/index.js';

export function registerMemoryCreateProject(
  server: McpServer,
  session: Session,
): void {
  server.registerTool(
    'memory_create_project',
    {
      title: 'Create Project',
      description: `Create a new memory project with optional template. Available templates: ${templateNames.join(', ')}. After creation, switches to the new project.`,
      inputSchema: z.object({
        name: z.string().describe('Project name (e.g. "my-agent-memory")'),
        template: z
          .string()
          .optional()
          .describe(
            `Template to use: ${templateNames.join(', ')} (default: agent-memory)`,
          ),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
      },
    },
    async ({ name, template: templateName }) => {
      try {
        const effectiveTemplate = templateName ?? 'agent-memory';
        const template = getTemplate(effectiveTemplate);

        if (!template) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Error: Unknown template "${effectiveTemplate}". Available templates: ${templateNames.join(', ')}`,
              },
            ],
            isError: true,
          };
        }

        await session.connect();
        const config = session.getConfig();
        const org = session.getClient().org(config.org!);

        await org.createProject({
          projectName: name,
          branchName: 'master',
        });

        const draft = await session.getClient().revision({
          org: config.org!,
          project: name,
        });

        for (const [tableId, schema] of Object.entries(template.tables)) {
          await draft.createTable(tableId, schema);
        }

        await draft.commit(`Initialize from template: ${template.name}`);

        session.switchProject(name);
        await session.saveConfig();

        return {
          content: [
            {
              type: 'text' as const,
              text: `Project "${name}" created with template "${effectiveTemplate}" and set as active.`,
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
