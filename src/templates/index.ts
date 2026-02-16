import agentMemory from './agent-memory.json';
import bookmarks from './bookmarks.json';
import contacts from './contacts.json';
import expenses from './expenses.json';
import jobSearch from './job-search.json';
import research from './research.json';
import tasks from './tasks.json';

export interface TableSchema {
  type: 'object';
  properties: Record<string, Record<string, unknown>>;
  additionalProperties: false;
  required: string[];
}

export interface Template {
  name: string;
  description: string;
  version: string;
  tables: Record<string, TableSchema>;
}

export const agentMemoryTemplate: Template = agentMemory as Template;
export const bookmarksTemplate: Template = bookmarks as Template;
export const contactsTemplate: Template = contacts as Template;
export const expensesTemplate: Template = expenses as Template;
export const jobSearchTemplate: Template = jobSearch as Template;
export const researchTemplate: Template = research as Template;
export const tasksTemplate: Template = tasks as Template;

export const templates: Record<string, Template> = {
  'agent-memory': agentMemoryTemplate,
  bookmarks: bookmarksTemplate,
  contacts: contactsTemplate,
  expenses: expensesTemplate,
  'job-search': jobSearchTemplate,
  research: researchTemplate,
  tasks: tasksTemplate,
};

export const templateNames = Object.keys(templates);

export function getTemplate(name: string): Template | undefined {
  return templates[name];
}
