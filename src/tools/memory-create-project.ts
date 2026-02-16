import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import type { Session } from '../session.js';
import { getTemplate, templateNames } from '../templates/index.js';

const tableSchemaZ = z.object({
  type: z.literal('object'),
  properties: z.record(z.record(z.unknown())),
  additionalProperties: z.literal(false),
  required: z.array(z.string()),
});

export function registerMemoryCreateProject(
  server: McpServer,
  session: Session,
): void {
  server.registerTool(
    'memory_create_project',
    {
      title: 'Create Project',
      description: `Create a new memory project. Use "template" for a preset (${templateNames.join(', ')}) or "tables" for a custom schema. After creation, switches to the new project.`,
      inputSchema: z.object({
        name: z.string().describe('Project name (e.g. "my-agent-memory")'),
        template: z
          .string()
          .optional()
          .describe(
            `Preset template: ${templateNames.join(', ')} (default: agent-memory). Ignored if "tables" is provided.`,
          ),
        tables: z
          .record(tableSchemaZ)
          .optional()
          .describe(
            'Custom table schemas. Keys are table names, values are JSON Schema objects with type, properties, additionalProperties, required.',
          ),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
      },
    },
    async ({ name, template: templateName, tables: customTables }) => {
      try {
        let tables: Record<string, object>;
        let label: string;

        if (customTables) {
          tables = customTables;
          label = 'custom schema';
        } else {
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

          tables = template.tables;
          label = `template "${effectiveTemplate}"`;
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

        for (const [tableId, schema] of Object.entries(tables)) {
          await draft.createTable(tableId, schema);
        }

        await draft.commit(`Initialize with ${label}`);

        session.switchProject(name);
        await session.saveConfig();

        return {
          content: [
            {
              type: 'text' as const,
              text: `Project "${name}" created with ${label} (tables: ${Object.keys(tables).join(', ')}) and set as active.`,
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
