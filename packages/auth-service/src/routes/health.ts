import type { Router } from "express";
import { createHealthRoutes } from "@telehealth/shared";
import { pingDb } from "../db.js";

export const healthRouter: Router = createHealthRoutes({
  service: "auth-service",
  ready: { db: pingDb },
});
