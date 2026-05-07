import { closeServer, installShutdown } from "@telehealth/shared";
import { audit } from "./audit.js";
import { config } from "./config.js";
import { pool, pingDb } from "./db.js";
import { ensureBucketExists } from "./lib/s3.js";
import { logger } from "./logger.js";
import { buildServer } from "./server.js";

async function main() {
  await pingDb();
  await ensureBucketExists();
  const app = buildServer();
  const server = app.listen(config.port, () => {
    logger.info(
      {
        port: config.port,
        env: config.nodeEnv,
        s3Bucket: config.s3.bucket,
        s3Endpoint: config.s3.endpoint,
      },
      "listening",
    );
  });

  installShutdown({
    logger,
    steps: [
      { name: "http-server", run: () => closeServer(server) },
      { name: "audit-mongo", run: () => audit.close() },
      { name: "pg-pool", run: () => pool.end() },
    ],
  });
}

main().catch((err: unknown) => {
  logger.fatal({ err }, "failed to start");
  process.exit(1);
});
