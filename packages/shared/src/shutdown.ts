import type { Logger } from "./logger.js";

// Graceful-shutdown contract:
//   1. SIGINT / SIGTERM received.
//   2. Run each step in order, logging start + result. Failures don't
//      abort — we still try the remaining steps so e.g. an HTTP-close
//      hang doesn't prevent the DB pool from draining.
//   3. Hard timeout (default 15s) forces process.exit(1) so a stuck step
//      can't keep the process alive forever (orchestrators like k8s would
//      eventually SIGKILL anyway, but we prefer to log the cause first).
//
// Re-entry: a second signal during shutdown is ignored — repeated Ctrl+C
// or duplicate SIGTERM from compose down won't restart the sequence.

export interface ShutdownStep {
  name: string;
  run: () => Promise<unknown> | void;
}

export interface InstallShutdownOptions {
  logger: Logger;
  steps: ShutdownStep[];
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 15_000;

export function installShutdown(opts: InstallShutdownOptions): void {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let shuttingDown = false;

  const handle = (signal: string): void => {
    if (shuttingDown) {
      opts.logger.warn({ signal }, "already shutting down, ignoring");
      return;
    }
    shuttingDown = true;
    opts.logger.info({ signal, steps: opts.steps.length, timeoutMs }, "shutting down");

    const timer = setTimeout(() => {
      opts.logger.error({ timeoutMs }, "shutdown timed out, forcing exit");
      process.exit(1);
    }, timeoutMs);
    timer.unref();

    void runSteps(opts.steps, opts.logger).finally(() => {
      clearTimeout(timer);
      opts.logger.info("shutdown complete");
      process.exit(0);
    });
  };

  process.on("SIGINT", () => handle("SIGINT"));
  process.on("SIGTERM", () => handle("SIGTERM"));
}

async function runSteps(steps: ShutdownStep[], logger: Logger): Promise<void> {
  for (const step of steps) {
    const startedAt = Date.now();
    try {
      await step.run();
      logger.info({ step: step.name, ms: Date.now() - startedAt }, "shutdown step ok");
    } catch (err: unknown) {
      logger.error(
        { err, step: step.name, ms: Date.now() - startedAt },
        "shutdown step failed",
      );
    }
  }
}

// Helper: turn server.close(cb) into a Promise. Node's http.Server stops
// accepting new connections immediately; close() resolves only when all
// in-flight requests have finished.
export function closeServer(server: { close: (cb?: (err?: Error) => void) => void }): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}
