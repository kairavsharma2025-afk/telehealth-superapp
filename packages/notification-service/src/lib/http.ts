import type { NextFunction, Request, Response } from "express";
import { type ZodError, type ZodSchema } from "zod";
import { ServiceError } from "@telehealth/shared";

export function asyncHandler<T extends Request, R extends Response>(
  fn: (req: T, res: R, next: NextFunction) => Promise<unknown>,
) {
  return (req: T, res: R, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}

export function parseBody<T>(schema: ZodSchema<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ServiceError("VALIDATION_FAILED", "Invalid request body", flattenZod(result.error));
  }
  return result.data;
}

function flattenZod(err: ZodError) {
  return err.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
}

export function errorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ServiceError) {
    res.status(err.status).json(err.toJSON());
    return;
  }
  console.error("[unhandled]", err);
  res.status(500).json({ error: { code: "INTERNAL", message: "Internal server error" } });
}
