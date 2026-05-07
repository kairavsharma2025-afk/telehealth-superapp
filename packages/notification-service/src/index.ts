import { closeServer, installShutdown } from "@telehealth/shared";
import { config } from "./config.js";
import { pool, pingDb } from "./db.js";
import { logger } from "./logger.js";
import { buildServer } from "./server.js";
import { startWorker, stopWorker } from "./worker.js";

async function main() {
  await pingDb();
  const app = buildServer();
  const server = app.listen(config.port, () => {
    const stubs: string[] = [];
    if (!config.providers.sesFromEmail) stubs.push("email");
    if (!config.providers.twilioAccountSid) stubs.push("sms");
    if (!config.providers.fcmServerKey) stubs.push("push");
    logger.info(
      { port: config.port, env: config.nodeEnv, providerStubs: stubs },
      "listening",
    );
  });
  startWorker();

  // Order matters: stop the worker first so it doesn't open a fresh DB
  // txn after we close the HTTP server, then drain HTTP, then end the
  // pool. Each step has the in-flight tick / request / query bounded.
  installShutdown({
    logger,
    steps: [
      { name: "queue-worker", run: stopWorker },
      { name: "http-server", run: () => closeServer(server) },
      { name: "pg-pool", run: () => pool.end() },
    ],
  });
}

main().catch((err: unknown) => {
  logger.fatal({ err }, "failed to start");
  process.exit(1);
});
