import { config } from "./config.js";
import { pool, pingDb } from "./db.js";
import { buildServer } from "./server.js";

async function main() {
  await pingDb();
  const app = buildServer();
  const server = app.listen(config.port, () => {
    console.log(`[notification-service] listening on :${config.port} (${config.nodeEnv})`);
    const stubs: string[] = [];
    if (!config.providers.sesFromEmail) stubs.push("email");
    if (!config.providers.twilioAccountSid) stubs.push("sms");
    if (!config.providers.fcmServerKey) stubs.push("push");
    if (stubs.length) console.log(`[notification-service] provider stubs: ${stubs.join(", ")}`);
  });

  const shutdown = (signal: string) => {
    console.log(`[notification-service] ${signal} — shutting down`);
    server.close(() => {
      void pool.end().finally(() => process.exit(0));
    });
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err: unknown) => {
  console.error("[notification-service] failed to start", err);
  process.exit(1);
});
