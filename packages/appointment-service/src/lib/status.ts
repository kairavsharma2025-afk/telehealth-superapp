import type { UserRole } from "@telehealth/shared";

export const APPOINTMENT_STATUSES = [
  "scheduled",
  "confirmed",
  "completed",
  "cancelled",
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

// (role, from, to) -> allowed?
// Patient can only cancel their own scheduled/confirmed bookings.
// Doctor drives the medical-side transitions.
// Admin gets a superset: anything a doctor can do, plus cancellations.
export function canTransition(
  role: UserRole,
  from: AppointmentStatus,
  to: AppointmentStatus,
): boolean {
  if (from === to) return false;
  if (from === "completed" || from === "cancelled") return false;

  if (to === "cancelled") return true; // any role can cancel a non-terminal slot

  if (role === "doctor" || role === "admin") {
    if (from === "scheduled" && to === "confirmed") return true;
    if (from === "confirmed" && to === "completed") return true;
  }
  return false;
}
