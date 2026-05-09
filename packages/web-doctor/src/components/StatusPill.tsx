export type AppointmentStatus = "scheduled" | "confirmed" | "completed" | "cancelled";

const LABEL: Record<AppointmentStatus, string> = {
  scheduled: "Scheduled",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
};

const TONE: Record<AppointmentStatus, string> = {
  scheduled: "bg-amber-50 text-amber-700 ring-amber-200",
  confirmed: "bg-blue-50 text-blue-700 ring-blue-200",
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  cancelled: "bg-rose-50 text-rose-700 ring-rose-200",
};

export function StatusPill({ status }: { status: AppointmentStatus }) {
  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 " +
        TONE[status]
      }
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {LABEL[status]}
    </span>
  );
}
