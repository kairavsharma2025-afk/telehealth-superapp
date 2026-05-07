import type { Router } from "express";
import { createHealthRoutes } from "@telehealth/shared";
import { pingDb } from "../db.js";
import { pingBucket } from "../lib/s3.js";

export const healthRouter: Router = createHealthRoutes({
  service: "upload-service",
  ready: { db: pingDb, s3: pingBucket },
});
