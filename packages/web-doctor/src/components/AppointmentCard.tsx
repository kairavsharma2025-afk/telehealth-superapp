import { StatusPill, type AppointmentStatus } from "./StatusPill";
import { displayName, type LookupItem } from "../lib/queries";

export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  startAt: string;
  endAt: string;
  status: AppointmentStatus;
  reason: string | null;
}

interface AppointmentCardProps {
  appointment: Appointment;
  onTransition: (status: AppointmentStatus) => void;
  busy?: boolean;
  patient?: LookupItem | undefined;
}

const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: "short" });
const monthDayFmt = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

export function AppointmentCard({
  appointment,
  onTransition,
  busy,
  patient,
}: AppointmentCardProps) {
  const start = new Date(appointment.startAt);
  const end = new Date(appointment.endAt);

  const canConfirm = appointment.status === "scheduled";
  const canComplete = appointment.status === "confirmed";
  const canCancel = appointment.status === "scheduled" || appointment.status === "confirmed";

  const patientName = displayName(appointment.patientId, patient, "patient");

  return (
    <li className="flex items-center gap-4 border-b border-border px-4 py-3 last:border-b-0 transition hover:bg-[#FBFCFD]">
      <div
        className="flex h-[58px] w-[72px] flex-shrink-0 flex-col items-center justify-center rounded-lg border border-border bg-[#FBFCFD] leading-tight"
        aria-hidden="true"
      >
        <span className="text-[10.5px] font-semibold uppercase tracking-wider text-ink-subtle">
          {dayFmt.format(start)}
        </span>
        <span className="mt-0.5 text-[14px] font-semibold text-ink tabular-nums">
          {timeFmt.format(start)}
        </span>
        <span className="text-[10.5px] text-ink-muted">{monthDayFmt.format(start)}</span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-medium text-ink">
          {patientName}
          <span className="ml-1.5 text-[12px] font-normal text-ink-subtle">
            · #{appointment.patientId.slice(0, 8)}
          </span>
        </div>
        <div className="mt-0.5 truncate text-[12.5px] text-ink-muted">
          {appointment.reason ?? "No reason provided"}
          <span className="ml-1 text-ink-subtle">
            · {timeFmt.format(start)}–{timeFmt.format(end)}
          </span>
        </div>
      </div>

      <div className="flex flex-shrink-0 items-center gap-2.5">
        <StatusPill status={appointment.status} />
        <div className="hidden items-center gap-1 sm:flex">
          {canConfirm ? (
            <button
              onClick={() => onTransition("confirmed")}
              disabled={busy}
              className="rounded-md border border-border bg-white px-2.5 py-1 text-[12px] font-medium text-ink transition hover:bg-[#F6F8FA] disabled:opacity-50"
            >
              Confirm
            </button>
          ) : null}
          {canComplete ? (
            <button
              onClick={() => onTransition("completed")}
              disabled={busy}
              className="rounded-md bg-brand-700 px-2.5 py-1 text-[12px] font-medium text-white transition hover:bg-brand-800 disabled:opacity-50"
            >
              Complete
            </button>
          ) : null}
          {canCancel ? (
            <button
              onClick={() => onTransition("cancelled")}
              disabled={busy}
              className="rounded-md px-2.5 py-1 text-[12px] font-medium text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
            >
              Cancel
            </button>
          ) : null}
        </div>
      </div>
    </li>
  );
}
