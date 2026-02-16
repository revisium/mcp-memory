import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { ChildProcess } from 'node:child_process';

const mockSpawn = jest.fn<() => ChildProcess>();

jest.unstable_mockModule('node:child_process', () => ({
  spawn: mockSpawn,
}));

const { StandaloneManager } = await import('../standalone-manager.js');

type MockChild = ChildProcess & {
  emit: (event: string, ...args: unknown[]) => void;
};

function createMockChildProcess(): MockChild {
  const listeners = new Map<string, ((...args: unknown[]) => void)[]>();
  return {
    kill: jest.fn(),
    on: jest.fn((event: string, handler: (...args: unknown[]) => void) => {
      const existing = listeners.get(event) ?? [];
      existing.push(handler);
      listeners.set(event, existing);
    }),
    removeListener: jest.fn(
      (event: string, handler: (...args: unknown[]) => void) => {
        const existing = listeners.get(event) ?? [];
        listeners.set(
          event,
          existing.filter((h) => h !== handler),
        );
      },
    ),
    emit: (event: string, ...args: unknown[]) => {
      const handlers = listeners.get(event) ?? [];
      for (const handler of handlers) {
        handler(...args);
      }
    },
  } as unknown as MockChild;
}

describe('StandaloneManager', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    mockSpawn.mockReset();
  });

  describe('forUrl', () => {
    it('should return manager for localhost URL', () => {
      const manager = StandaloneManager.forUrl('http://localhost:9222', {});
      expect(manager).not.toBeNull();
    });

    it('should return manager for 127.0.0.1 URL', () => {
      const manager = StandaloneManager.forUrl('http://127.0.0.1:9222', {});
      expect(manager).not.toBeNull();
    });

    it('should return manager for ::1 URL', () => {
      const manager = StandaloneManager.forUrl('http://[::1]:9222', {});
      expect(manager).not.toBeNull();
    });

    it('should return null for remote URL', () => {
      const manager = StandaloneManager.forUrl(
        'https://revisium.example.com',
        {},
      );
      expect(manager).toBeNull();
    });

    it('should return null for invalid URL', () => {
      const manager = StandaloneManager.forUrl('not-a-url', {});
      expect(manager).toBeNull();
    });

    it('should extract port from URL', () => {
      const manager = StandaloneManager.forUrl('http://localhost:3456', {});
      expect(manager).not.toBeNull();
    });
  });

  describe('ensureRunning', () => {
    it('should skip spawn if already healthy', async () => {
      const manager = StandaloneManager.forUrl('http://localhost:9222', {});
      expect(manager).not.toBeNull();

      jest
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(new Response('OK', { status: 200 }));

      await manager!.ensureRunning();

      expect(mockSpawn).not.toHaveBeenCalled();
    });

    it('should spawn and wait for ready when not healthy', async () => {
      const manager = StandaloneManager.forUrl('http://localhost:9222', {});
      expect(manager).not.toBeNull();

      const mockChild = createMockChildProcess();
      mockSpawn.mockReturnValue(mockChild);

      let callCount = 0;
      jest.spyOn(globalThis, 'fetch').mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('ECONNREFUSED'));
        }
        return Promise.resolve(new Response('OK', { status: 200 }));
      });

      await manager!.ensureRunning();

      expect(mockSpawn).toHaveBeenCalledWith(
        'npx',
        ['@revisium/standalone@latest', '--port', '9222'],
        { stdio: ['ignore', 'pipe', 'pipe'], detached: false },
      );
    });

    it('should pass --auth flag when auth is true', async () => {
      const manager = StandaloneManager.forUrl('http://localhost:9222', {
        auth: true,
      });
      expect(manager).not.toBeNull();

      const mockChild = createMockChildProcess();
      mockSpawn.mockReturnValue(mockChild);

      let callCount = 0;
      jest.spyOn(globalThis, 'fetch').mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('ECONNREFUSED'));
        }
        return Promise.resolve(new Response('OK', { status: 200 }));
      });

      await manager!.ensureRunning();

      expect(mockSpawn).toHaveBeenCalledWith(
        'npx',
        ['@revisium/standalone@latest', '--port', '9222', '--auth'],
        { stdio: ['ignore', 'pipe', 'pipe'], detached: false },
      );
    });

    it('should pass --data flag when dataDir is set', async () => {
      const manager = StandaloneManager.forUrl('http://localhost:9222', {
        dataDir: './revisium-data',
      });
      expect(manager).not.toBeNull();

      const mockChild = createMockChildProcess();
      mockSpawn.mockReturnValue(mockChild);

      let callCount = 0;
      jest.spyOn(globalThis, 'fetch').mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('ECONNREFUSED'));
        }
        return Promise.resolve(new Response('OK', { status: 200 }));
      });

      await manager!.ensureRunning();

      const expectedArgs = [
        '@revisium/standalone@latest',
        '--port',
        '9222',
        '--data',
        './revisium-data',
      ];
      expect(mockSpawn).toHaveBeenCalledWith('npx', expectedArgs, {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
      });
    });

    it('should pass --pg-port flag when pgPort is set', async () => {
      const manager = StandaloneManager.forUrl('http://localhost:9222', {
        pgPort: 5441,
      });
      expect(manager).not.toBeNull();

      const mockChild = createMockChildProcess();
      mockSpawn.mockReturnValue(mockChild);

      let callCount = 0;
      jest.spyOn(globalThis, 'fetch').mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('ECONNREFUSED'));
        }
        return Promise.resolve(new Response('OK', { status: 200 }));
      });

      await manager!.ensureRunning();

      const expectedArgs = [
        '@revisium/standalone@latest',
        '--port',
        '9222',
        '--pg-port',
        '5441',
      ];
      expect(mockSpawn).toHaveBeenCalledWith('npx', expectedArgs, {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
      });
    });

    it('should throw if child exits before ready', async () => {
      const manager = StandaloneManager.forUrl('http://localhost:9222', {});
      expect(manager).not.toBeNull();

      const mockChild = createMockChildProcess();
      mockSpawn.mockReturnValue(mockChild);

      jest.spyOn(globalThis, 'fetch').mockImplementation(() => {
        return Promise.reject(new Error('ECONNREFUSED'));
      });

      const promise = manager!.ensureRunning();

      await new Promise((r) => setTimeout(r, 10));
      mockChild.emit('exit', 1);

      await expect(promise).rejects.toThrow(
        /exited with code 1 before becoming ready/,
      );
    });
  });

  describe('shutdown', () => {
    it('should kill child process and wait for exit', async () => {
      const manager = StandaloneManager.forUrl('http://localhost:9222', {});
      expect(manager).not.toBeNull();

      const mockChild = createMockChildProcess();
      mockSpawn.mockReturnValue(mockChild);

      let callCount = 0;
      jest.spyOn(globalThis, 'fetch').mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('ECONNREFUSED'));
        }
        return Promise.resolve(new Response('OK', { status: 200 }));
      });

      await manager!.ensureRunning();

      const shutdownPromise = manager!.shutdown();

      expect(mockChild.kill).toHaveBeenCalledWith('SIGTERM');

      mockChild.emit('exit', 0);
      await shutdownPromise;
    });

    it('should be safe to call when no child process', async () => {
      const manager = StandaloneManager.forUrl('http://localhost:9222', {});
      expect(manager).not.toBeNull();

      await manager!.shutdown();
    });
  });
});
