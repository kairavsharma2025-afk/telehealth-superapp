import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import { httpLogger } from "@telehealth/shared";
import { errorMiddleware } from "./lib/http.js";
import { logger } from "./logger.js";
import { healthRouter } from "./routes/health.js";
import { uploadsRouter } from "./routes/uploads.js";

export function buildServer(): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(httpLogger(logger));
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: "100kb" }));

  app.use(healthRouter);
  app.use("/uploads", uploadsRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found" } });
  });
  app.use(errorMiddleware);

  return app;
}
