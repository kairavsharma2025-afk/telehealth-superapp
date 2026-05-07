import { closeServer, installShutdown } from "@telehealth/shared";
import { config } from "./config.js";
import { pool, pingDb } from "./db.js";
import { logger } from "./logger.js";
import { buildServer } from "./server.js";

async function main() {
  await pingDb();
  const app = buildServer();
  const server = app.listen(config.port, () => {
    logger.info({ port: config.port, env: config.nodeEnv }, "listening");
  });

  installShutdown({
    logger,
    steps: [
      { name: "http-server", run: () => closeServer(server) },
      { name: "pg-pool", run: () => pool.end() },
    ],
  });
}

main().catch((err: unknown) => {
  logger.fatal({ err }, "failed to start");
  process.exit(1);
});
