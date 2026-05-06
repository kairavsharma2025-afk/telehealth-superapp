import { config } from "./config.js";
import { logger } from "./logger.js";
import { buildServer } from "./server.js";

function main() {
  const app = buildServer();
  const server = app.listen(config.port, () => {
    logger.info(
      {
        port: config.port,
        env: config.nodeEnv,
        upstreams: config.upstreams,
      },
      "listening",
    );
  });

  const shutdown = (signal: string) => {
    logger.info({ signal }, "shutting down");
    server.close(() => process.exit(0));
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main();
