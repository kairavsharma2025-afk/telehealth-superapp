import { Router } from "express";
import { z } from "zod";
import { ServiceError } from "@telehealth/shared";
import { pool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../lib/http.js";

// /users/doctors — directory of bookable doctors plus availability search.
// Both endpoints reach across into the appointment-service's `appointments`
// table; the same trade-off the admin endpoints already make while both
// services share a Postgres instance.

export const doctorsRouter: Router = Router();
doctorsRouter.use(requireAuth);

interface DoctorRow {
  id: string;
  full_name: string | null;
  specialty: string | null;
}

doctorsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const result = await pool.query<DoctorRow>(
      `SELECT u.id, p.full_name, p.specialty
         FROM users u
         LEFT JOIN profiles p ON p.user_id = u.id
        WHERE u.role = 'doctor' AND u.is_active = TRUE
        ORDER BY p.specialty NULLS LAST, p.full_name NULLS LAST, u.id
        LIMIT 200`,
    );
    res.json({
      items: result.rows.map((r) => ({
        id: r.id,
        fullName: r.full_name,
        specialty: r.specialty,
      })),
    });
  }),
);

// GET /users/doctors/availability — patient picks a window + (optional)
// specialty, server returns doctors who have at least one $duration-minute
// slot inside that window with no scheduled/confirmed conflicts. Each
// returned doctor carries the *earliest* such slot — that's what the UI
// pre-fills into the booking form, so the patient picks a doctor instead
// of negotiating against a calendar.
const availabilityQuerySchema = z.object({
  specialty: z.string().min(1).max(100).optional(),
  start: z.string().datetime(),
  end: z.string().datetime(),
  duration: z.coerce.number().int().min(15).max(120).default(30),
});

interface ConflictRow {
  doctor_id: string;
  start_at: Date;
  end_at: Date;
}

const SLOT_GRANULARITY_MS = 15 * 60_000;

doctorsRouter.get(
  "/availability",
  asyncHandler(async (req, res) => {
    const parsed = availabilityQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new ServiceError(
        "VALIDATION_FAILED",
        "Invalid query (need start, end as ISO datetimes; specialty + duration optional)",
      );
    }
    const { specialty, start, end, duration } = parsed.data;

    const startMs = Date.parse(start);
    const endMs = Date.parse(end);
    const durationMs = duration * 60_000;
    if (!(startMs < endMs)) {
      throw new ServiceError("VALIDATION_FAILED", "start must be before end");
    }
    if (endMs - startMs < durationMs) {
      throw new ServiceError(
        "VALIDATION_FAILED",
        "Window is shorter than the requested duration",
      );
    }

    // Step 1: candidate doctors of the requested specialty (or all).
    const params: unknown[] = [];
    let specialtyFilter = "";
    if (specialty) {
      params.push(specialty);
      specialtyFilter = ` AND p.specialty = $${params.length}`;
    }
    const doctorsResult = await pool.query<DoctorRow>(
      `SELECT u.id, p.full_name, p.specialty
         FROM users u
         LEFT JOIN profiles p ON p.user_id = u.id
        WHERE u.role = 'doctor' AND u.is_active = TRUE${specialtyFilter}
        LIMIT 200`,
      params,
    );

    if (doctorsResult.rows.length === 0) {
      res.json({ items: [] });
      return;
    }

    // Step 2: every conflicting appointment for those doctors in the window.
    // Standard half-open interval overlap: a < d.end && b > d.start.
    const doctorIds = doctorsResult.rows.map((d) => d.id);
    const conflictsResult = await pool.query<ConflictRow>(
      `SELECT doctor_id, start_at, end_at
         FROM appointments
        WHERE doctor_id = ANY($1::uuid[])
          AND status IN ('scheduled', 'confirmed')
          AND start_at < $3::timestamptz
          AND end_at   > $2::timestamptz
        ORDER BY doctor_id, start_at`,
      [doctorIds, start, end],
    );

    const byDoctor = new Map<string, { startMs: number; endMs: number }[]>();
    for (const c of conflictsResult.rows) {
      const list = byDoctor.get(c.doctor_id) ?? [];
      list.push({ startMs: c.start_at.getTime(), endMs: c.end_at.getTime() });
      byDoctor.set(c.doctor_id, list);
    }

    // Step 3: first-fit slot per doctor, rounded to a 15-min grid.
    const items = doctorsResult.rows
      .flatMap((d) => {
        const slot = firstAvailableSlot(
          startMs,
          endMs,
          durationMs,
          byDoctor.get(d.id) ?? [],
        );
        if (!slot) return [];
        return [
          {
            id: d.id,
            fullName: d.full_name,
            specialty: d.specialty,
            suggestedStartAt: new Date(slot.start).toISOString(),
            suggestedEndAt: new Date(slot.end).toISOString(),
          },
        ];
      })
      .sort(
        (a, b) =>
          Date.parse(a.suggestedStartAt) - Date.parse(b.suggestedStartAt),
      );

    res.json({ window: { start, end, duration }, items });
  }),
);

function firstAvailableSlot(
  windowStart: number,
  windowEnd: number,
  duration: number,
  conflicts: { startMs: number; endMs: number }[],
): { start: number; end: number } | null {
  let cursor = roundUp(windowStart, SLOT_GRANULARITY_MS);

  for (const c of conflicts) {
    if (cursor + duration <= c.startMs) {
      return { start: cursor, end: cursor + duration };
    }
    if (c.endMs > cursor) {
      cursor = roundUp(c.endMs, SLOT_GRANULARITY_MS);
    }
  }

  if (cursor + duration <= windowEnd) {
    return { start: cursor, end: cursor + duration };
  }
  return null;
}

function roundUp(t: number, granularity: number): number {
  return Math.ceil(t / granularity) * granularity;
}
