import { describe, it, expect, afterAll } from '@jest/globals';

import { StandaloneManager } from '../standalone-manager.js';

const AUTO_START_PORT = 9333;
const AUTO_START_PG_PORT = 5441;
const AUTO_START_URL = `http://localhost:${AUTO_START_PORT}`;
const DATA_DIR = '.revisium-autostart-test';

describe('StandaloneManager integration', () => {
  let manager: StandaloneManager | null = null;

  afterAll(async () => {
    if (manager) {
      await manager.shutdown();
      manager = null;
    }
    const { rm } = await import('node:fs/promises');
    await rm(DATA_DIR, { recursive: true, force: true });
  });

  it('should auto-start standalone and respond to health check', async () => {
    manager = StandaloneManager.forUrl(AUTO_START_URL, {
      dataDir: DATA_DIR,
      pgPort: AUTO_START_PG_PORT,
    });
    expect(manager).not.toBeNull();

    await manager!.ensureRunning();

    const response = await fetch(`${AUTO_START_URL}/health/liveness`);
    expect(response.ok).toBe(true);
  }, 120_000);

  it('should skip spawn if standalone is already running', async () => {
    const secondManager = StandaloneManager.forUrl(AUTO_START_URL, {
      dataDir: DATA_DIR,
      pgPort: AUTO_START_PG_PORT,
    });
    expect(secondManager).not.toBeNull();

    await secondManager!.ensureRunning();

    const response = await fetch(`${AUTO_START_URL}/health/liveness`);
    expect(response.ok).toBe(true);
  }, 120_000);
});
