import { config } from "./config.js";
import { pool, pingDb } from "./db.js";
import { ensureBucketExists } from "./lib/s3.js";
import { buildServer } from "./server.js";

async function main() {
  await pingDb();
  await ensureBucketExists();
  const app = buildServer();
  const server = app.listen(config.port, () => {
    console.log(`[upload-service] listening on :${config.port} (${config.nodeEnv})`);
    console.log(`[upload-service] s3 bucket=${config.s3.bucket} endpoint=${config.s3.endpoint}`);
  });

  const shutdown = (signal: string) => {
    console.log(`[upload-service] ${signal} — shutting down`);
    server.close(() => {
      pool.end().finally(() => process.exit(0));
    });
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err: unknown) => {
  console.error("[upload-service] failed to start", err);
  process.exit(1);
});
