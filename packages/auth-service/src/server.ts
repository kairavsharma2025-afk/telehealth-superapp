import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import { createMetrics, httpLogger } from "@telehealth/shared";
import { errorMiddleware } from "./lib/http.js";
import { logger } from "./logger.js";
import { adminRouter } from "./routes/admin.js";
import { authRouter } from "./routes/auth.js";
import { healthRouter } from "./routes/health.js";

export function buildServer(): Express {
  const app = express();
  const metrics = createMetrics({ service: "auth-service" });
  app.disable("x-powered-by");
  app.use(httpLogger(logger));
  app.use(metrics.middleware);
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: "100kb" }));

  app.use(healthRouter);
  app.use(metrics.router);
  app.use("/auth", authRouter);
  app.use("/admin", adminRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found" } });
  });
  app.use(errorMiddleware);

  return app;
}
