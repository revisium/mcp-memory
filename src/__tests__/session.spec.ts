import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockLogin = jest.fn<() => Promise<void>>();
const mockLoginWithToken = jest.fn();
const mockMe = jest.fn<() => Promise<{ id: string; username?: string }>>();
const mockGetProject = jest.fn<() => Promise<{ name: string }>>();
const mockCreateProject =
  jest.fn<() => Promise<{ name: string; id: string }>>();
const mockCreateTable = jest.fn<() => Promise<{ table: { id: string } }>>();
const mockRevisionCommit =
  jest.fn<() => Promise<{ id: string; createdAt: string }>>();

const mockDraftScope = {
  createTable: mockCreateTable,
  commit: mockRevisionCommit,
  isDisposed: false,
  dispose: jest.fn(),
};

const mockHeadScope = {
  isDisposed: false,
  dispose: jest.fn(),
};

const mockBranchScope = {
  branchName: 'master',
  headRevisionId: 'head-1',
  draftRevisionId: 'draft-1',
  draft: jest.fn().mockReturnValue(mockDraftScope),
  head: jest.fn().mockReturnValue(mockHeadScope),
};

const mockBranch = jest.fn<() => Promise<typeof mockBranchScope>>();
const mockRevision = jest.fn<() => Promise<typeof mockDraftScope>>();

jest.unstable_mockModule('@revisium/client', () => ({
  RevisiumClient: jest.fn().mockImplementation(() => ({
    login: mockLogin,
    loginWithToken: mockLoginWithToken,
    me: mockMe,
    org: jest.fn().mockReturnValue({
      project: jest.fn().mockReturnValue({
        get: mockGetProject,
      }),
      createProject: mockCreateProject,
    }),
    branch: mockBranch.mockResolvedValue(mockBranchScope),
    revision: mockRevision.mockResolvedValue(mockDraftScope),
  })),
}));

jest.unstable_mockModule('node:fs/promises', () => ({
  readFile: jest
    .fn<() => Promise<string>>()
    .mockRejectedValue(new Error('ENOENT')),
  writeFile: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  mkdir: jest
    .fn<() => Promise<string | undefined>>()
    .mockResolvedValue(undefined),
}));

const { Session } = await import('../session.js');

describe('Session', () => {
  let session: InstanceType<typeof Session>;

  beforeEach(() => {
    jest.clearAllMocks();
    session = new Session({
      url: 'http://localhost:9222',
      username: 'admin',
      password: 'admin',
      project: 'test-memory',
      branch: 'master',
    });
  });

  describe('connect', () => {
    it('should login with credentials', async () => {
      mockMe.mockResolvedValue({ id: 'user-1', username: 'admin' });
      await session.connect();

      expect(mockLogin).toHaveBeenCalledWith('admin', 'admin');
      expect(session.isConnected()).toBe(true);
      expect(session.getConfig().org).toBe('admin');
    });

    it('should login with token when provided', async () => {
      const tokenSession = new Session({
        url: 'http://localhost:9222',
        token: 'test-token',
        project: 'test-memory',
        branch: 'master',
      });

      mockMe.mockResolvedValue({ id: 'user-1', username: 'admin' });
      await tokenSession.connect();

      expect(mockLoginWithToken).toHaveBeenCalledWith('test-token');
      expect(tokenSession.isConnected()).toBe(true);
    });

    it('should not login twice', async () => {
      mockMe.mockResolvedValue({ id: 'user-1', username: 'admin' });
      await session.connect();
      await session.connect();

      expect(mockLogin).toHaveBeenCalledTimes(1);
    });

    it('should use id as org if username is missing', async () => {
      mockMe.mockResolvedValue({ id: 'user-1', username: undefined });
      const noOrgSession = new Session({
        url: 'http://localhost:9222',
        username: 'admin',
        password: 'admin',
        project: 'test-memory',
        branch: 'master',
      });
      await noOrgSession.connect();

      expect(noOrgSession.getConfig().org).toBe('user-1');
    });
  });

  describe('ensureProject', () => {
    beforeEach(() => {
      mockMe.mockResolvedValue({ id: 'user-1', username: 'admin' });
    });

    it('should not create project if it already exists', async () => {
      mockGetProject.mockResolvedValue({ name: 'test-memory' });
      await session.ensureProject();

      expect(mockCreateProject).not.toHaveBeenCalled();
    });

    it('should create project with template if not found', async () => {
      mockGetProject.mockRejectedValue(new Error('Not found'));
      mockCreateProject.mockResolvedValue({
        name: 'test-memory',
        id: 'proj-1',
      });
      mockCreateTable.mockResolvedValue({
        table: { id: 'facts' },
      });
      mockRevisionCommit.mockResolvedValue({
        id: 'rev-1',
        createdAt: '2024-01-01',
      });

      await session.ensureProject();

      expect(mockCreateProject).toHaveBeenCalledWith({
        projectName: 'test-memory',
        branchName: 'master',
      });
      expect(mockCreateTable).toHaveBeenCalledTimes(3);
    });
  });

  describe('switchProject', () => {
    it('should update config and reset project state', () => {
      session.switchProject('new-project');
      const config = session.getConfig();

      expect(config.project).toBe('new-project');
      expect(config.branch).toBe('master');
    });
  });

  describe('switchBranch', () => {
    it('should update branch in config', () => {
      session.switchBranch('feature-branch');
      const config = session.getConfig();

      expect(config.branch).toBe('feature-branch');
    });
  });

  describe('getDraft', () => {
    beforeEach(() => {
      mockMe.mockResolvedValue({ id: 'user-1', username: 'admin' });
      mockGetProject.mockResolvedValue({ name: 'test-memory' });
    });

    it('should return draft scope', async () => {
      const draft = await session.getDraft();
      expect(draft).toBeDefined();
      expect(mockBranchScope.draft).toHaveBeenCalled();
    });
  });

  describe('getHead', () => {
    beforeEach(() => {
      mockMe.mockResolvedValue({ id: 'user-1', username: 'admin' });
      mockGetProject.mockResolvedValue({ name: 'test-memory' });
    });

    it('should return head scope', async () => {
      const head = await session.getHead();
      expect(head).toBeDefined();
      expect(mockBranchScope.head).toHaveBeenCalled();
    });
  });
});
