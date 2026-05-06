import { Router } from "express";
import { pingDb } from "../db.js";
import { asyncHandler } from "../lib/http.js";

export const healthRouter: Router = Router();

healthRouter.get(
  "/health",
  asyncHandler(async (_req, res) => {
    await pingDb();
    res.json({ status: "ok", service: "auth-service", db: "ok" });
  }),
);
