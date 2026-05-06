import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { ServiceError, type UserRole, isUserRole } from "@telehealth/shared";
import { config } from "../config.js";

export interface AuthContext {
  userId: string;
  role: UserRole;
}

declare module "express-serve-static-core" {
  interface Request {
    auth?: AuthContext;
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.header("authorization");
  if (!header || !header.toLowerCase().startsWith("bearer ")) {
    return next(new ServiceError("UNAUTHORIZED", "Missing bearer token"));
  }
  const token = header.slice(7).trim();

  let decoded: unknown;
  try {
    decoded = jwt.verify(token, config.jwtAccessSecret);
  } catch {
    return next(new ServiceError("UNAUTHORIZED", "Invalid or expired access token"));
  }

  if (typeof decoded !== "object" || decoded === null) {
    return next(new ServiceError("UNAUTHORIZED", "Malformed access token"));
  }
  const o = decoded as Record<string, unknown>;
  if (typeof o["sub"] !== "string" || !isUserRole(o["role"])) {
    return next(new ServiceError("UNAUTHORIZED", "Malformed access token"));
  }

  req.auth = { userId: o["sub"], role: o["role"] };
  next();
}
