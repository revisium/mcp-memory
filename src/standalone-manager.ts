import { type ChildProcess, spawn } from 'node:child_process';

export interface StandaloneManagerOptions {
  url: string;
  port: number;
  dataDir?: string;
  auth?: boolean;
  pgPort?: number;
}

const LOCALHOST_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const HEALTH_TIMEOUT_MS = 3000;
const READY_TIMEOUT_MS = 120_000;
const POLL_INITIAL_MS = 500;
const POLL_MAX_MS = 3000;
const POLL_BACKOFF = 1.5;

export class StandaloneManager {
  private childProcess: ChildProcess | null = null;
  private cleanupRegistered = false;

  constructor(private readonly options: StandaloneManagerOptions) {}

  static forUrl(
    url: string,
    opts: { auth?: boolean; dataDir?: string; pgPort?: number },
  ): StandaloneManager | null {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return null;
    }

    const hostname = parsed.hostname.replace(/^\[|\]$/g, '');
    if (!LOCALHOST_HOSTS.has(hostname)) {
      return null;
    }

    const defaultPort = parsed.protocol === 'https:' ? 443 : 80;
    const port = parsed.port ? Number(parsed.port) : defaultPort;

    return new StandaloneManager({
      url,
      port,
      auth: opts.auth,
      dataDir: opts.dataDir,
      pgPort: opts.pgPort,
    });
  }

  async ensureRunning(): Promise<void> {
    if (await this.isHealthy()) {
      this.log('Revisium standalone already running');
      return;
    }

    this.log('Starting Revisium standalone...');
    this.spawnStandalone();
    await this.waitForReady(READY_TIMEOUT_MS);
    this.log('Revisium standalone is ready');
  }

  shutdown(): Promise<void> {
    return this.killChild(true);
  }

  private async isHealthy(): Promise<boolean> {
    try {
      const response = await fetch(`${this.options.url}/health/liveness`, {
        signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private spawnStandalone(): void {
    const args = [
      '@revisium/standalone@latest',
      '--port',
      String(this.options.port),
    ];

    if (this.options.auth) {
      args.push('--auth');
    }

    if (this.options.dataDir) {
      args.push('--data', this.options.dataDir);
    }

    if (this.options.pgPort) {
      args.push('--pg-port', String(this.options.pgPort));
    }

    // eslint-disable-next-line sonarjs/no-os-command-from-path -- npx resolves @revisium/standalone
    this.childProcess = spawn('npx', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    });

    this.childProcess.stdout?.on('data', (chunk: Buffer) => {
      this.log(chunk.toString().trimEnd());
    });
    this.childProcess.stderr?.on('data', (chunk: Buffer) => {
      this.log(chunk.toString().trimEnd());
    });

    this.registerCleanup();
  }

  private async waitForReady(timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    let delay = POLL_INITIAL_MS;

    return new Promise<void>((resolve, reject) => {
      const exitHandler = (code: number | null) => {
        reject(
          new Error(
            `Revisium standalone exited with code ${code} before becoming ready. ` +
              'Start it manually: npx @revisium/standalone --port ' +
              this.options.port,
          ),
        );
      };

      this.childProcess?.on('exit', exitHandler);

      const poll = (): void => {
        if (Date.now() > deadline) {
          this.childProcess?.removeListener('exit', exitHandler);
          void this.killChild();
          reject(
            new Error(
              `Revisium standalone did not become ready within ${timeoutMs / 1000}s. ` +
                'Start it manually: npx @revisium/standalone --port ' +
                this.options.port,
            ),
          );
          return;
        }

        this.isHealthy()
          .then((healthy) => {
            if (healthy) {
              this.childProcess?.removeListener('exit', exitHandler);
              resolve();
              return;
            }

            delay = Math.min(delay * POLL_BACKOFF, POLL_MAX_MS);
            setTimeout(poll, delay);
          })
          .catch(() => {
            delay = Math.min(delay * POLL_BACKOFF, POLL_MAX_MS);
            setTimeout(poll, delay);
          });
      };

      setTimeout(poll, delay);
    });
  }

  private killChild(wait?: boolean): Promise<void> {
    if (!this.childProcess) {
      return Promise.resolve();
    }

    const child = this.childProcess;
    this.childProcess = null;

    child.stdout?.destroy();
    child.stderr?.destroy();
    child.kill('SIGTERM');

    if (!wait) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        child.kill('SIGKILL');
        resolve();
      }, 5000);

      child.on('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  private registerCleanup(): void {
    if (this.cleanupRegistered) {
      return;
    }
    this.cleanupRegistered = true;

    const cleanup = () => {
      if (this.childProcess) {
        this.childProcess.kill('SIGTERM');
        this.childProcess = null;
      }
    };

    process.on('exit', cleanup);
    process.on('SIGINT', () => {
      cleanup();
      process.exit(130);
    });
    process.on('SIGTERM', () => {
      cleanup();
      process.exit(143);
    });
  }

  private log(msg: string): void {
    process.stderr.write(`[mcp-memory] ${msg}\n`);
  }
}
