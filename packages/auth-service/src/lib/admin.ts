import type { NextFunction, Request, Response } from "express";
import { ServiceError } from "@telehealth/shared";

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.auth) return next(new ServiceError("UNAUTHORIZED", "Auth context missing"));
  if (req.auth.role !== "admin") {
    return next(new ServiceError("FORBIDDEN", "Admin role required"));
  }
  next();
}
