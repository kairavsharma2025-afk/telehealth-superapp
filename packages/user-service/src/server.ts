import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import { errorMiddleware } from "./lib/http.js";
import { healthRouter } from "./routes/health.js";
import { meRouter } from "./routes/me.js";

export function buildServer(): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: "100kb" }));

  app.use(healthRouter);
  app.use("/users/me", meRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found" } });
  });
  app.use(errorMiddleware);

  return app;
}
