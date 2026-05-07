import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, type ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Layout } from "../components/Layout";
import { StatusPill, type AppointmentStatus } from "../components/StatusPill";

interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  startAt: string;
  endAt: string;
  status: AppointmentStatus;
  reason: string | null;
}
interface ListResult {
  items: Appointment[];
}

const dayFmt = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
});
const timeFmt = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});

function startOfWeek(d: Date): Date {
  const out = new Date(d);
  const day = out.getDay(); // 0 = Sunday
  // Treat Monday as start of week (more clinical-friendly).
  const offset = day === 0 ? -6 : 1 - day;
  out.setDate(out.getDate() + offset);
  out.setHours(0, 0, 0, 0);
  return out;
}

export function SchedulePage() {
  const { user } = useAuth();
  const query = useQuery<ListResult, ApiError>({
    queryKey: ["appointments"],
    queryFn: () => api<ListResult>("/appointments"),
  });

  const week = useMemo(() => {
    const now = new Date();
    const monday = startOfWeek(now);
    const days: { date: Date; appts: Appointment[] }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push({ date: d, appts: [] });
    }

    const mine = (query.data?.items ?? []).filter(
      (a) => a.doctorId === user?.id && a.status !== "cancelled",
    );
    for (const a of mine) {
      const start = new Date(a.startAt);
      const idx = Math.floor(
        (new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime() -
          monday.getTime()) /
          (24 * 3600_000),
      );
      if (idx >= 0 && idx < 7) days[idx]?.appts.push(a);
    }
    for (const d of days) {
      d.appts.sort(
        (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
      );
    }
    return days;
  }, [query.data, user?.id]);

  return (
    <Layout title="Schedule" meta={<span>This week (read-only)</span>}>
      <div className="alert alert-error" style={{
        background: "var(--color-info-subtle)",
        color: "var(--color-info)",
        border: "1px solid #BFDBFE",
      }}>
        Schedule editing is coming soon. Your calendar currently reflects
        confirmed patient bookings.
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
          gap: 12,
        }}
      >
        {week.map(({ date, appts }) => {
          const isToday =
            date.toDateString() === new Date().toDateString();
          return (
            <div
              key={date.toISOString()}
              className="card"
              style={{
                padding: 12,
                minHeight: 320,
                ...(isToday
                  ? { borderColor: "var(--color-brand-700)" }
                  : {}),
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--color-text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: 0.6,
                }}
              >
                {dayFmt.format(date).split(",")[0]}
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  color: isToday ? "var(--color-brand-700)" : "var(--color-text)",
                  marginBottom: 8,
                }}
              >
                {date.getDate()}
              </div>
              <div className="stack-2">
                {appts.length === 0 ? (
                  <div className="muted" style={{ fontSize: 12 }}>
                    No visits.
                  </div>
                ) : (
                  appts.map((a) => (
                    <Link
                      key={a.id}
                      to={`/appointments/${a.id}`}
                      style={{
                        background: "var(--color-brand-subtle)",
                        borderRadius: 6,
                        padding: "6px 8px",
                        textDecoration: "none",
                        color: "var(--color-brand-800)",
                        fontSize: 12,
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>
                        {timeFmt.format(new Date(a.startAt))}
                      </div>
                      <div
                        style={{
                          color: "var(--color-text-muted)",
                          marginTop: 2,
                          fontSize: 11,
                        }}
                      >
                        #{a.patientId.slice(0, 6)}
                      </div>
                      <div style={{ marginTop: 4 }}>
                        <StatusPill status={a.status} />
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Layout>
  );
}
