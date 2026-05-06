import { Router } from "express";
import { ServiceError } from "@telehealth/shared";
import { pool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler, parseBody } from "../lib/http.js";
import { upsertProfileSchema } from "../lib/validation.js";

export const meRouter: Router = Router();

interface ProfileRow {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  date_of_birth: string | null;
  created_at: string;
  updated_at: string;
}

function toApi(row: ProfileRow) {
  return {
    userId: row.user_id,
    fullName: row.full_name,
    phone: row.phone,
    dateOfBirth: row.date_of_birth,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

meRouter.use(requireAuth);

meRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    if (!req.auth) throw new ServiceError("UNAUTHORIZED", "Auth context missing");
    const result = await pool.query<ProfileRow>(
      `SELECT user_id, full_name, phone, date_of_birth, created_at, updated_at
         FROM profiles WHERE user_id = $1`,
      [req.auth.userId],
    );
    const row = result.rows[0];
    if (!row) throw new ServiceError("NOT_FOUND", "Profile not yet created");
    res.json(toApi(row));
  }),
);

meRouter.put(
  "/",
  asyncHandler(async (req, res) => {
    if (!req.auth) throw new ServiceError("UNAUTHORIZED", "Auth context missing");
    const input = parseBody(upsertProfileSchema, req.body);

    const result = await pool.query<ProfileRow>(
      `INSERT INTO profiles (user_id, full_name, phone, date_of_birth)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE SET
         full_name     = COALESCE(EXCLUDED.full_name,     profiles.full_name),
         phone         = COALESCE(EXCLUDED.phone,         profiles.phone),
         date_of_birth = COALESCE(EXCLUDED.date_of_birth, profiles.date_of_birth)
       RETURNING user_id, full_name, phone, date_of_birth, created_at, updated_at`,
      [
        req.auth.userId,
        input.fullName ?? null,
        input.phone ?? null,
        input.dateOfBirth ?? null,
      ],
    );
    const row = result.rows[0];
    if (!row) throw new ServiceError("INTERNAL", "Upsert returned no row");
    res.json(toApi(row));
  }),
);
