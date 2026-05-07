export type AppointmentStatus = "scheduled" | "confirmed" | "completed" | "cancelled";

const LABEL: Record<AppointmentStatus, string> = {
  scheduled: "Scheduled",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function StatusPill({ status }: { status: AppointmentStatus }) {
  return <span className={`pill pill-${status}`}>{LABEL[status]}</span>;
}
