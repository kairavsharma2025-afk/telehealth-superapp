import type { NextFunction, Request, Response } from "express";
import { ServiceError } from "@telehealth/shared";

export function errorMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ServiceError) {
    res.status(err.status).json(err.toJSON());
    return;
  }
  console.error("[gateway:unhandled]", { requestId: req.requestId, err });
  res.status(500).json({ error: { code: "INTERNAL", message: "Internal server error" } });
}
