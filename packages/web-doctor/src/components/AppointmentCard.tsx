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
    <li className="appt-row">
      <div className="appt-time" aria-hidden="true">
        <span className="day">{dayFmt.format(start)}</span>
        <span className="time">{timeFmt.format(start)}</span>
        <span className="date">{monthDayFmt.format(start)}</span>
      </div>

      <div className="appt-main">
        <div className="who">
          {patientName}{" "}
          <span className="muted" style={{ fontWeight: 400 }}>
            · #{appointment.patientId.slice(0, 8)}
          </span>
        </div>
        <div className="reason">
          {appointment.reason ?? "No reason provided"}
          <span className="muted"> · {timeFmt.format(start)}–{timeFmt.format(end)}</span>
        </div>
      </div>

      <div className="appt-side">
        <StatusPill status={appointment.status} />
        <div className="appt-actions">
          {canConfirm ? (
            <button onClick={() => onTransition("confirmed")} disabled={busy}>
              Confirm
            </button>
          ) : null}
          {canComplete ? (
            <button onClick={() => onTransition("completed")} disabled={busy}>
              Complete
            </button>
          ) : null}
          {canCancel ? (
            <button
              className="secondary"
              onClick={() => onTransition("cancelled")}
              disabled={busy}
            >
              Cancel
            </button>
          ) : null}
        </div>
      </div>
    </li>
  );
}
