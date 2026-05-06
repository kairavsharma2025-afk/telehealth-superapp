import { config } from "./config.js";
import { buildServer } from "./server.js";

function main() {
  const app = buildServer();
  const server = app.listen(config.port, () => {
    console.log(`[api-gateway] listening on :${config.port} (${config.nodeEnv})`);
    console.log(`[api-gateway] proxy /auth -> ${config.upstreams.auth}`);
  });

  const shutdown = (signal: string) => {
    console.log(`[api-gateway] ${signal} — shutting down`);
    server.close(() => process.exit(0));
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main();
