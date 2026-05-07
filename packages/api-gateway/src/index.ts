import { closeServer, installShutdown } from "@telehealth/shared";
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

  installShutdown({
    logger,
    steps: [{ name: "http-server", run: () => closeServer(server) }],
  });
}

main();
