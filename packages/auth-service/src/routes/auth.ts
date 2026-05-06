import { Router } from "express";
import { ServiceError, type UserRole } from "@telehealth/shared";
import { pool } from "../db.js";
import { hashPassword, verifyPassword } from "../lib/passwords.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../lib/tokens.js";
import { asyncHandler, parseBody } from "../lib/http.js";
import { loginSchema, refreshSchema, registerSchema } from "../lib/validation.js";

export const authRouter: Router = Router();

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  role: UserRole;
  is_active: boolean;
}

authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const { email, password, role } = parseBody(registerSchema, req.body);
    const password_hash = await hashPassword(password);

    let row: UserRow;
    try {
      const result = await pool.query<UserRow>(
        `INSERT INTO users (email, password_hash, role)
         VALUES ($1, $2, $3)
         RETURNING id, email, password_hash, role, is_active`,
        [email, password_hash, role],
      );
      const inserted = result.rows[0];
      if (!inserted) throw new ServiceError("INTERNAL", "Insert returned no row");
      row = inserted;
    } catch (err: unknown) {
      if (isUniqueViolation(err)) {
        throw new ServiceError("CONFLICT", "Email already registered");
      }
      throw err;
    }

    const accessToken = signAccessToken({ sub: row.id, role: row.role });
    const refreshToken = signRefreshToken({ sub: row.id });

    res.status(201).json({
      user: { id: row.id, email: row.email, role: row.role },
      accessToken,
      refreshToken,
    });
  }),
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = parseBody(loginSchema, req.body);

    const result = await pool.query<UserRow>(
      `SELECT id, email, password_hash, role, is_active
         FROM users
        WHERE LOWER(email) = LOWER($1)`,
      [email],
    );
    const row = result.rows[0];
    if (!row || !row.is_active) {
      throw new ServiceError("UNAUTHORIZED", "Invalid credentials");
    }

    const ok = await verifyPassword(password, row.password_hash);
    if (!ok) throw new ServiceError("UNAUTHORIZED", "Invalid credentials");

    const accessToken = signAccessToken({ sub: row.id, role: row.role });
    const refreshToken = signRefreshToken({ sub: row.id });

    res.json({
      user: { id: row.id, email: row.email, role: row.role },
      accessToken,
      refreshToken,
    });
  }),
);

authRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const { refreshToken } = parseBody(refreshSchema, req.body);
    const claims = verifyRefreshToken(refreshToken);

    const result = await pool.query<{ id: string; role: UserRole; is_active: boolean }>(
      `SELECT id, role, is_active FROM users WHERE id = $1`,
      [claims.sub],
    );
    const row = result.rows[0];
    if (!row || !row.is_active) {
      throw new ServiceError("UNAUTHORIZED", "User no longer valid");
    }

    res.json({
      accessToken: signAccessToken({ sub: row.id, role: row.role }),
    });
  }),
);

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === "23505"
  );
}
