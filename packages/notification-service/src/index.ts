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

  const shutdown = (signal: string) => {
    logger.info({ signal }, "shutting down");
    void stopWorker().finally(() => {
      server.close(() => {
        void pool.end().finally(() => process.exit(0));
      });
    });
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err: unknown) => {
  logger.fatal({ err }, "failed to start");
  process.exit(1);
});
