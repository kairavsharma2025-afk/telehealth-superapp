import { config } from "./config.js";
import { pool, pingDb } from "./db.js";
import { buildServer } from "./server.js";

async function main() {
  await pingDb();
  const app = buildServer();
  const server = app.listen(config.port, () => {
    console.log(`[appointment-service] listening on :${config.port} (${config.nodeEnv})`);
  });

  const shutdown = (signal: string) => {
    console.log(`[appointment-service] ${signal} — shutting down`);
    server.close(() => {
      pool.end().finally(() => process.exit(0));
    });
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err: unknown) => {
  console.error("[appointment-service] failed to start", err);
  process.exit(1);
});
