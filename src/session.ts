import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { RevisiumClient } from '@revisium/client';
import type { BranchScope, RevisionScope } from '@revisium/client';

import { getTemplate } from './templates/index.js';

export interface SessionConfig {
  url: string;
  username?: string;
  password?: string;
  token?: string;
  org?: string;
  project: string;
  branch: string;
}

interface PersistedConfig {
  org?: string;
  project?: string;
  branch?: string;
}

const CONFIG_DIR = join(homedir(), '.revisium-memory');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

export class Session {
  private readonly client: RevisiumClient;
  private config: SessionConfig;
  private branchScope: BranchScope | null = null;
  private draftScope: RevisionScope | null = null;
  private headScope: RevisionScope | null = null;
  private connected = false;
  private projectEnsured = false;
  private ensurePromise: Promise<void> | null = null;

  constructor(config: SessionConfig) {
    this.config = config;
    this.client = new RevisiumClient({ baseUrl: config.url });
  }

  public getConfig(): SessionConfig {
    return this.config;
  }

  public getClient(): RevisiumClient {
    return this.client;
  }

  public isConnected(): boolean {
    return this.connected;
  }

  public async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    if (this.config.token) {
      this.client.loginWithToken(this.config.token);
    } else if (this.config.username && this.config.password) {
      await this.client.login(this.config.username, this.config.password);
    }

    if (!this.config.org) {
      const me = await this.client.me();
      this.config.org = me.username ?? me.id;
    }

    this.connected = true;
  }

  public async ensureProject(templateName?: string): Promise<void> {
    if (this.projectEnsured) {
      return;
    }
    if (this.ensurePromise) {
      return this.ensurePromise;
    }
    this.ensurePromise = this.doEnsureProject(templateName);
    try {
      await this.ensurePromise;
    } finally {
      this.ensurePromise = null;
    }
  }

  private async doEnsureProject(templateName?: string): Promise<void> {
    await this.connect();

    const org = this.client.org(this.config.org!);
    const project = org.project(this.config.project);

    try {
      await project.get();
      this.projectEnsured = true;
      return;
    } catch (error: unknown) {
      if (!isNotFoundError(error)) {
        throw error;
      }
    }

    await org.createProject({
      projectName: this.config.project,
      branchName: this.config.branch,
    });

    const effectiveTemplate = templateName ?? 'agent-memory';
    const template = getTemplate(effectiveTemplate);

    if (template) {
      const draft = await this.client.revision({
        org: this.config.org!,
        project: this.config.project,
      });

      for (const [tableId, schema] of Object.entries(template.tables)) {
        await draft.createTable(tableId, schema);
      }

      await draft.commit(`Initialize from template: ${template.name}`);
    }

    this.projectEnsured = true;
  }

  public async getDraft(): Promise<RevisionScope> {
    await this.connect();
    await this.ensureProject();

    if (!this.draftScope || this.draftScope.isDisposed) {
      const branch = await this.getBranchScope();
      this.draftScope = branch.draft();
    }
    return this.draftScope;
  }

  public async getHead(): Promise<RevisionScope> {
    await this.connect();
    await this.ensureProject();

    if (!this.headScope || this.headScope.isDisposed) {
      const branch = await this.getBranchScope();
      this.headScope = branch.head();
    }
    return this.headScope;
  }

  public async getBranchScope(): Promise<BranchScope> {
    await this.connect();
    await this.ensureProject();

    this.branchScope ??= await this.client.branch({
      org: this.config.org!,
      project: this.config.project,
      branch: this.config.branch,
    });
    return this.branchScope;
  }

  public switchProject(projectName: string): void {
    this.disposeScopes();
    this.config = { ...this.config, project: projectName, branch: 'master' };
    this.projectEnsured = false;
  }

  public switchBranch(branchName: string): void {
    this.disposeScopes();
    this.config = { ...this.config, branch: branchName };
  }

  public async saveConfig(): Promise<void> {
    const data: PersistedConfig = {
      org: this.config.org,
      project: this.config.project,
      branch: this.config.branch,
    };
    await mkdir(CONFIG_DIR, { recursive: true });
    await writeFile(CONFIG_FILE, JSON.stringify(data, null, 2));
  }

  public async loadConfig(): Promise<void> {
    try {
      const raw = await readFile(CONFIG_FILE, 'utf-8');
      const data = JSON.parse(raw) as PersistedConfig;
      if (data.org) {
        this.config.org = data.org;
      }
      if (data.project) {
        this.config.project = data.project;
      }
      if (data.branch) {
        this.config.branch = data.branch;
      }
    } catch {
      // no config file yet
    }
  }

  private disposeScopes(): void {
    if (this.draftScope && !this.draftScope.isDisposed) {
      this.draftScope.dispose();
    }
    this.draftScope = null;
    if (this.headScope && !this.headScope.isDisposed) {
      this.headScope.dispose();
    }
    this.headScope = null;
    this.branchScope = null;
  }
}

function isNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const msg = error.message.toLowerCase();
  return msg.includes('not found') || msg.includes('does not exist');
}
