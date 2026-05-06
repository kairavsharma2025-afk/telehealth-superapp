import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import { httpLogger } from "@telehealth/shared";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { requireAuth, requireRole } from "./middleware/auth.js";
import { errorMiddleware } from "./middleware/errors.js";
import { healthRouter } from "./routes/health.js";
import { buildProxy } from "./routes/proxy.js";

export function buildServer(): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(httpLogger(logger));
  app.use(helmet());
  app.use(cors());

  app.use(healthRouter);

  app.get("/whoami", requireAuth, (req, res) => {
    res.json({ auth: req.auth, requestId: req.id });
  });

  app.use(buildProxy({ prefix: "/auth", target: config.upstreams.auth }));

  app.use("/admin", requireAuth, requireRole("admin"));
  app.use(buildProxy({ prefix: "/admin", target: config.upstreams.auth }));

  app.use("/users", requireAuth);
  app.use(buildProxy({ prefix: "/users", target: config.upstreams.user }));

  app.use("/appointments", requireAuth);
  app.use(buildProxy({ prefix: "/appointments", target: config.upstreams.appointment }));

  app.use("/uploads", requireAuth);
  app.use(buildProxy({ prefix: "/uploads", target: config.upstreams.upload }));

  app.use("/notifications", requireAuth);
  app.use(buildProxy({ prefix: "/notifications", target: config.upstreams.notification }));

  app.use((_req, res) => {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found" } });
  });
  app.use(errorMiddleware);

  return app;
}
