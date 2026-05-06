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

  const shutdown = (signal: string) => {
    logger.info({ signal }, "shutting down");
    server.close(() => {
      void pool.end().finally(() => process.exit(0));
    });
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err: unknown) => {
  logger.fatal({ err }, "failed to start");
  process.exit(1);
});
