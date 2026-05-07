import { Router } from "express";
import { z } from "zod";
import { ServiceError } from "@telehealth/shared";
import { pool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../lib/http.js";

// GET /users/lookup?ids=uuid1,uuid2,...
//
// Resolves a batch of user IDs to their display name + role. Used by
// the doctor console to render patient names on the Patients page,
// the Appointments list, and inside the consultation flow — places
// where the doctor needs to see "Aarav Sharma", not "#a1b2c3".
//
// Auth: any authenticated user. The response carries only id +
// fullName + role (no email / phone / DOB) so a doctor looking up
// patient identity-display info doesn't accidentally see private
// fields, and a patient resolving their doctor's display name
// doesn't see anything they couldn't already get from
// /users/doctors. Caps batch size at 200 to keep the URL bounded
// and the SELECT predictable.

export const lookupRouter: Router = Router();
lookupRouter.use(requireAuth);

const idsSchema = z
  .string()
  .transform((raw) => raw.split(",").map((s) => s.trim()).filter(Boolean));

interface LookupRow {
  id: string;
  full_name: string | null;
  role: "patient" | "doctor" | "admin";
}

lookupRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const raw = req.query["ids"];
    if (typeof raw !== "string" || raw.length === 0) {
      throw new ServiceError("VALIDATION_FAILED", "Missing ids query parameter");
    }
    const parsed = idsSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ServiceError("VALIDATION_FAILED", "Invalid ids");
    }
    const ids = parsed.data;
    if (ids.length === 0) {
      res.json({ items: [] });
      return;
    }
    if (ids.length > 200) {
      throw new ServiceError(
        "VALIDATION_FAILED",
        "Too many ids — cap is 200 per request",
      );
    }
    for (const id of ids) {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
        throw new ServiceError("VALIDATION_FAILED", "Invalid uuid in ids");
      }
    }

    const result = await pool.query<LookupRow>(
      `SELECT u.id, p.full_name, u.role
         FROM users u
         LEFT JOIN profiles p ON p.user_id = u.id
        WHERE u.id = ANY($1::uuid[])`,
      [ids],
    );
    res.json({
      items: result.rows.map((r) => ({
        id: r.id,
        fullName: r.full_name,
        role: r.role,
      })),
    });
  }),
);
