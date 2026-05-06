import { Router } from "express";
import { z } from "zod";
import { ServiceError, type UserRole } from "@telehealth/shared";
import { pool } from "../db.js";
import { asyncHandler, parseBody } from "../lib/http.js";
import { requireAdmin } from "../lib/admin.js";
import { requireAuth } from "../middleware/auth.js";

export const adminRouter: Router = Router();
adminRouter.use(requireAuth, requireAdmin);

interface UserRow {
  id: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

function toApi(row: UserRow) {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    isActive: row.is_active,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

const SELECT_COLUMNS = "id, email, role, is_active, created_at, updated_at";

const listQuerySchema = z.object({
  includeInactive: z.enum(["true", "false"]).optional(),
  role: z.enum(["patient", "doctor", "admin"]).optional(),
});

adminRouter.get(
  "/users",
  asyncHandler(async (req, res) => {
    const query = listQuerySchema.safeParse(req.query);
    if (!query.success) throw new ServiceError("VALIDATION_FAILED", "Invalid query string");

    const filters: string[] = [];
    const params: unknown[] = [];

    if (query.data.includeInactive !== "true") {
      filters.push("is_active = TRUE");
    }
    if (query.data.role) {
      params.push(query.data.role);
      filters.push(`role = $${params.length}`);
    }

    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const result = await pool.query<UserRow>(
      `SELECT ${SELECT_COLUMNS} FROM users ${where}
        ORDER BY created_at DESC LIMIT 200`,
      params,
    );
    res.json({ items: result.rows.map(toApi) });
  }),
);

adminRouter.get(
  "/users/:id",
  asyncHandler(async (req, res) => {
    const id = req.params["id"];
    if (!id || !isUuid(id)) throw new ServiceError("BAD_REQUEST", "Invalid id");
    const result = await pool.query<UserRow>(
      `SELECT ${SELECT_COLUMNS} FROM users WHERE id = $1`,
      [id],
    );
    const row = result.rows[0];
    if (!row) throw new ServiceError("NOT_FOUND", "User not found");
    res.json(toApi(row));
  }),
);

const updateUserSchema = z.object({
  isActive: z.boolean(),
});

adminRouter.patch(
  "/users/:id",
  asyncHandler(async (req, res) => {
    if (!req.auth) throw new ServiceError("UNAUTHORIZED", "Auth context missing");
    const id = req.params["id"];
    if (!id || !isUuid(id)) throw new ServiceError("BAD_REQUEST", "Invalid id");
    if (id === req.auth.userId) {
      throw new ServiceError("CONFLICT", "Admins cannot deactivate themselves");
    }
    const input = parseBody(updateUserSchema, req.body);

    const result = await pool.query<UserRow>(
      `UPDATE users SET is_active = $2 WHERE id = $1 RETURNING ${SELECT_COLUMNS}`,
      [id, input.isActive],
    );
    const row = result.rows[0];
    if (!row) throw new ServiceError("NOT_FOUND", "User not found");
    res.json(toApi(row));
  }),
);

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
