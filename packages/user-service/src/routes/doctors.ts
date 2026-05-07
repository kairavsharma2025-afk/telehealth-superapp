import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../lib/http.js";

// GET /users/doctors — public-within-the-app directory of bookable doctors.
// Any authenticated caller can see this list (patients pick from it when
// booking, doctors/admins see it for completeness). Cross-service read of
// auth-service's `users` table is OK while both services share the same
// Postgres instance — same trade-off the admin endpoints already make.

export const doctorsRouter: Router = Router();
doctorsRouter.use(requireAuth);

interface DoctorRow {
  id: string;
  full_name: string | null;
}

doctorsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const result = await pool.query<DoctorRow>(
      `SELECT u.id, p.full_name
         FROM users u
         LEFT JOIN profiles p ON p.user_id = u.id
        WHERE u.role = 'doctor' AND u.is_active = TRUE
        ORDER BY p.full_name NULLS LAST, u.id
        LIMIT 200`,
    );
    res.json({
      items: result.rows.map((r) => ({
        id: r.id,
        fullName: r.full_name,
      })),
    });
  }),
);
