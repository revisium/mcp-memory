import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import type { Session } from '../session.js';

const tableSchemaZ = z.object({
  type: z.literal('object'),
  properties: z.record(z.record(z.unknown())),
  additionalProperties: z.literal(false),
  required: z.array(z.string()),
});

const jsonPatchZ = z.object({
  op: z.enum(['add', 'remove', 'replace', 'move', 'copy']),
  path: z.string(),
  from: z.string().optional(),
  value: z.unknown().optional(),
});

export function registerMemoryUpdateSchema(
  server: McpServer,
  session: Session,
): void {
  server.registerTool(
    'memory_update_schema',
    {
      title: 'Update Schema',
      description: `Modify table schemas: add/update/delete/rename tables, or patch fields on an existing table.

ACTIONS:
- "add_table": Create a new table with full JSON Schema
- "update_table": Apply JSON Patch (RFC 6902) to modify an existing table schema
- "rename_table": Rename a table
- "delete_table": Remove a table and all its data

SCHEMA RULES (for add_table and patch values):
- Root: type "object", additionalProperties false, required array listing ALL field names
- string: {"type":"string","default":""} — REQUIRED: default
  - Optional: foreignKey, pattern, format (date-time|date|time|email|regex), enum, contentMediaType (text/markdown|text/html|text/plain), readOnly, x-formula, description, title, deprecated
- number: {"type":"number","default":0} — REQUIRED: default
  - Optional: readOnly, x-formula, description, title, deprecated
- boolean: {"type":"boolean","default":false} — REQUIRED: default
  - Optional: readOnly, x-formula, description, title, deprecated
- array: {"type":"array","items":{...}} — NO default allowed
  - items: any valid field schema (string, number, boolean, object, array, $ref)
  - Array of strings: {"type":"array","items":{"type":"string","default":""}}
  - Array of objects: {"type":"array","items":{"type":"object","properties":{...},"additionalProperties":false,"required":[...]}}
- object (nested): {"type":"object","properties":{...},"additionalProperties":false,"required":[...]} — NO default allowed
- $ref (file): {"$ref":"File"} — NO default allowed
- foreignKey: string field with "foreignKey":"other-table" (referenced table must exist, cannot coexist with x-formula)
- x-formula: computed field, requires "readOnly":true, field MUST be in required array
  - {"type":"number","default":0,"readOnly":true,"x-formula":{"version":1,"expression":"price * quantity"}}

JSON PATCH OPERATIONS (for update_table) — always call memory_get_schema first!
5 operations: add, replace, remove, move, copy
- add/replace: {"op":"add|replace","path":"...","value":{valid field schema}}
- remove: {"op":"remove","path":"..."}
- move/copy: {"op":"move|copy","from":"...","path":"..."}

COMMON PATTERNS:
- Add field: [{"op":"add","path":"/properties/tags","value":{"type":"array","items":{"type":"string","default":""}}},{"op":"add","path":"/required/-","value":"tags"}]
- Remove field: [{"op":"remove","path":"/properties/oldField"},{"op":"remove","path":"/required/INDEX"}] (find INDEX of field in required array)
- Rename field: [{"op":"move","from":"/properties/old","path":"/properties/new"},{"op":"replace","path":"/required/INDEX","value":"new"}]
- Change field type: [{"op":"replace","path":"/properties/field","value":{"type":"number","default":0}}]`,
      inputSchema: z.object({
        action: z
          .enum(['add_table', 'update_table', 'rename_table', 'delete_table'])
          .describe('Action to perform'),
        table: z.string().describe('Table name'),
        schema: tableSchemaZ
          .optional()
          .describe('Full table schema (for add_table)'),
        patches: z
          .array(jsonPatchZ)
          .optional()
          .describe(
            'JSON Patch operations (for update_table). Always call memory_get_schema first.',
          ),
        newName: z
          .string()
          .optional()
          .describe('New table name (for rename_table)'),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
      },
    },
    async ({ action, table, schema, patches, newName }) => {
      try {
        const draft = await session.getDraft();

        switch (action) {
          case 'add_table': {
            if (!schema) {
              return {
                content: [
                  {
                    type: 'text' as const,
                    text: 'Error: "schema" is required for add_table action.',
                  },
                ],
                isError: true,
              };
            }
            await draft.createTable(table, schema);
            return {
              content: [
                {
                  type: 'text' as const,
                  text: `Table "${table}" created with ${Object.keys(schema.properties).length} fields.`,
                },
              ],
            };
          }

          case 'update_table': {
            if (!patches || patches.length === 0) {
              return {
                content: [
                  {
                    type: 'text' as const,
                    text: 'Error: "patches" is required for update_table action.',
                  },
                ],
                isError: true,
              };
            }
            await draft.updateTable(table, patches as object[]);
            return {
              content: [
                {
                  type: 'text' as const,
                  text: `Table "${table}" schema updated (${patches.length} patch operations applied).`,
                },
              ],
            };
          }

          case 'rename_table': {
            if (!newName) {
              return {
                content: [
                  {
                    type: 'text' as const,
                    text: 'Error: "newName" is required for rename_table action.',
                  },
                ],
                isError: true,
              };
            }
            await draft.renameTable(table, newName);
            return {
              content: [
                {
                  type: 'text' as const,
                  text: `Table "${table}" renamed to "${newName}".`,
                },
              ],
            };
          }

          case 'delete_table': {
            await draft.deleteTable(table);
            return {
              content: [
                {
                  type: 'text' as const,
                  text: `Table "${table}" deleted.`,
                },
              ],
            };
          }
        }
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
