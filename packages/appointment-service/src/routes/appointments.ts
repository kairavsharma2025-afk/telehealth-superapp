import { Router } from "express";
import { ServiceError, type UserRole } from "@telehealth/shared";
import { audit } from "../audit.js";
import { pool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler, parseBody } from "../lib/http.js";
import {
  createAppointmentSchema,
  listQuerySchema,
  updateAppointmentSchema,
} from "../lib/validation.js";
import { canTransition, type AppointmentStatus } from "../lib/status.js";

export const appointmentsRouter: Router = Router();
appointmentsRouter.use(requireAuth);

interface AppointmentRow {
  id: string;
  patient_id: string;
  doctor_id: string;
  start_at: Date;
  end_at: Date;
  status: AppointmentStatus;
  reason: string | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

function toApi(row: AppointmentRow) {
  return {
    id: row.id,
    patientId: row.patient_id,
    doctorId: row.doctor_id,
    startAt: row.start_at.toISOString(),
    endAt: row.end_at.toISOString(),
    status: row.status,
    reason: row.reason,
    notes: row.notes,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

const SELECT_COLUMNS =
  "id, patient_id, doctor_id, start_at, end_at, status, reason, notes, created_at, updated_at";

appointmentsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    if (!req.auth) throw new ServiceError("UNAUTHORIZED", "Auth context missing");
    if (req.auth.role !== "patient") {
      throw new ServiceError("FORBIDDEN", "Only patients can book appointments");
    }
    const input = parseBody(createAppointmentSchema, req.body);

    if (new Date(input.startAt).getTime() < Date.now()) {
      throw new ServiceError("VALIDATION_FAILED", "startAt must be in the future");
    }

    const doctor = await pool.query<{ role: UserRole; is_active: boolean }>(
      "SELECT role, is_active FROM users WHERE id = $1",
      [input.doctorId],
    );
    const doc = doctor.rows[0];
    if (!doc || !doc.is_active || doc.role !== "doctor") {
      throw new ServiceError("BAD_REQUEST", "doctorId does not refer to an active doctor");
    }

    try {
      const result = await pool.query<AppointmentRow>(
        `INSERT INTO appointments (patient_id, doctor_id, start_at, end_at, reason)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING ${SELECT_COLUMNS}`,
        [req.auth.userId, input.doctorId, input.startAt, input.endAt, input.reason ?? null],
      );
      const row = result.rows[0];
      if (!row) throw new ServiceError("INTERNAL", "Insert returned no row");
      res.status(201).json(toApi(row));
    } catch (err: unknown) {
      throw mapPgError(err);
    }
  }),
);

appointmentsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    if (!req.auth) throw new ServiceError("UNAUTHORIZED", "Auth context missing");
    const query = listQuerySchema.safeParse(req.query);
    if (!query.success) {
      throw new ServiceError("VALIDATION_FAILED", "Invalid query string");
    }

    const filters: string[] = [];
    const params: unknown[] = [];

    // Admins see every appointment; everyone else is scoped to rows they
    // are part of (as patient OR doctor).
    if (req.auth.role !== "admin") {
      params.push(req.auth.userId);
      filters.push(`(patient_id = $${params.length} OR doctor_id = $${params.length})`);
    }

    if (query.data.status) {
      params.push(query.data.status);
      filters.push(`status = $${params.length}`);
    }
    if (query.data.from) {
      params.push(query.data.from);
      filters.push(`start_at >= $${params.length}`);
    }
    if (query.data.to) {
      params.push(query.data.to);
      filters.push(`start_at < $${params.length}`);
    }

    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const result = await pool.query<AppointmentRow>(
      `SELECT ${SELECT_COLUMNS} FROM appointments
        ${where}
        ORDER BY start_at DESC
        LIMIT 100`,
      params,
    );

    res.json({ items: result.rows.map(toApi) });
  }),
);

appointmentsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    if (!req.auth) throw new ServiceError("UNAUTHORIZED", "Auth context missing");
    const id = req.params["id"];
    if (!id || !isUuid(id)) throw new ServiceError("BAD_REQUEST", "Invalid id");

    const result = await pool.query<AppointmentRow>(
      `SELECT ${SELECT_COLUMNS} FROM appointments WHERE id = $1`,
      [id],
    );
    const row = result.rows[0];
    if (!row) throw new ServiceError("NOT_FOUND", "Appointment not found");
    if (
      req.auth.role !== "admin" &&
      row.patient_id !== req.auth.userId &&
      row.doctor_id !== req.auth.userId
    ) {
      throw new ServiceError("FORBIDDEN", "Not your appointment");
    }
    res.json(toApi(row));
  }),
);

// PATCH /:id — combined endpoint for status transitions AND clinical
// notes. Either field is optional; at least one must be present (the
// schema enforces). Permissions:
//   * status transitions follow canTransition() per role.
//   * notes are doctor-or-admin only — patients can't write clinical
//     notes against their own appointment.
appointmentsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    if (!req.auth) throw new ServiceError("UNAUTHORIZED", "Auth context missing");
    const id = req.params["id"];
    if (!id || !isUuid(id)) throw new ServiceError("BAD_REQUEST", "Invalid id");
    const input = parseBody(updateAppointmentSchema, req.body);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const current = await client.query<AppointmentRow>(
        `SELECT ${SELECT_COLUMNS} FROM appointments WHERE id = $1 FOR UPDATE`,
        [id],
      );
      const row = current.rows[0];
      if (!row) {
        await client.query("ROLLBACK");
        throw new ServiceError("NOT_FOUND", "Appointment not found");
      }
      const isPatient = row.patient_id === req.auth.userId;
      const isDoctor = row.doctor_id === req.auth.userId;
      const isAdmin = req.auth.role === "admin";
      if (!isPatient && !isDoctor && !isAdmin) {
        await client.query("ROLLBACK");
        throw new ServiceError("FORBIDDEN", "Not your appointment");
      }

      const sets: string[] = [];
      const values: unknown[] = [id];

      if (input.status !== undefined) {
        if (!canTransition(req.auth.role, row.status, input.status)) {
          await client.query("ROLLBACK");
          throw new ServiceError(
            "CONFLICT",
            `Cannot transition ${row.status} -> ${input.status} as ${req.auth.role}`,
          );
        }
        values.push(input.status);
        sets.push(`status = $${values.length}`);
      }

      if (input.notes !== undefined) {
        if (!isDoctor && !isAdmin) {
          await client.query("ROLLBACK");
          throw new ServiceError(
            "FORBIDDEN",
            "Only the doctor or an admin can edit clinical notes",
          );
        }
        values.push(input.notes);
        sets.push(`notes = $${values.length}`);
      }

      const updated = await client.query<AppointmentRow>(
        `UPDATE appointments SET ${sets.join(", ")} WHERE id = $1 RETURNING ${SELECT_COLUMNS}`,
        values,
      );
      await client.query("COMMIT");
      const updatedRow = updated.rows[0];
      if (!updatedRow) throw new ServiceError("INTERNAL", "Update returned no row");

      // Audit only admin-initiated status transitions — patient/doctor
      // actions are part of the normal appointment flow and are already
      // captured by the appointments table's updated_at + status columns.
      if (isAdmin && input.status !== undefined) {
        void audit.record({
          service: "appointment-service",
          action: "appointment.admin-transition",
          actor: { userId: req.auth.userId, role: req.auth.role },
          target: { type: "appointment", id: updatedRow.id },
          details: {
            from: row.status,
            to: input.status,
            patientId: updatedRow.patient_id,
            doctorId: updatedRow.doctor_id,
          },
          requestId: typeof req.id === "string" ? req.id : undefined,
        });
      }
      res.json(toApi(updatedRow));
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // ignore — already rolled back or txn never opened
      }
      throw err;
    } finally {
      client.release();
    }
  }),
);

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function mapPgError(err: unknown): unknown {
  if (typeof err === "object" && err !== null && "code" in err) {
    const code = (err).code;
    if (code === "23P01") {
      return new ServiceError("CONFLICT", "Doctor already has an overlapping appointment");
    }
    if (code === "23514") {
      return new ServiceError("VALIDATION_FAILED", "Constraint violation on appointment");
    }
    if (code === "23503") {
      return new ServiceError("BAD_REQUEST", "Referenced user does not exist");
    }
  }
  return err;
}
