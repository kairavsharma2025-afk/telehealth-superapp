import { z } from "zod";
import { APPOINTMENT_STATUSES } from "./status.js";

export const createAppointmentSchema = z
  .object({
    doctorId: z.string().uuid(),
    startAt: z.string().datetime({ offset: true }),
    endAt: z.string().datetime({ offset: true }),
    reason: z.string().max(500).optional(),
  })
  .refine((d) => new Date(d.endAt).getTime() > new Date(d.startAt).getTime(), {
    message: "endAt must be after startAt",
    path: ["endAt"],
  });
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;

// PATCH body — accepts an optional status transition and/or optional
// clinical notes. At least one must be present.
export const updateAppointmentSchema = z
  .object({
    status: z.enum(APPOINTMENT_STATUSES).optional(),
    notes: z.string().max(10_000).nullable().optional(),
  })
  .refine((d) => d.status !== undefined || d.notes !== undefined, {
    message: "must include status or notes",
  });
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;

export const listQuerySchema = z.object({
  status: z.enum(APPOINTMENT_STATUSES).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
});
export type ListQuery = z.infer<typeof listQuerySchema>;
