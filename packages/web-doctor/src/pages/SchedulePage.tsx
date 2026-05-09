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
});
const timeFmt = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});

function startOfWeek(d: Date): Date {
  const out = new Date(d);
  const day = out.getDay();
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
      <div className="mb-6 flex items-start gap-3 rounded-md border border-blue-200 bg-blue-50 px-3.5 py-2.5 text-[13px] text-blue-700">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className="mt-0.5 flex-shrink-0" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
        <div>
          Schedule editing is coming soon. Your calendar currently reflects confirmed
          patient bookings.
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
        {week.map(({ date, appts }) => {
          const isToday = date.toDateString() === new Date().toDateString();
          return (
            <div
              key={date.toISOString()}
              className={
                "min-h-[300px] rounded-xl border bg-white p-3 shadow-[0_1px_2px_0_rgba(15,23,42,0.04)] " +
                (isToday ? "border-brand-500 ring-1 ring-brand-500/20" : "border-border")
              }
            >
              <div className="text-[10.5px] font-semibold uppercase tracking-wider text-ink-subtle">
                {dayFmt.format(date)}
              </div>
              <div
                className={
                  "mb-2 text-[20px] font-semibold tabular-nums " +
                  (isToday ? "text-brand-700" : "text-ink")
                }
              >
                {date.getDate()}
              </div>
              <div className="space-y-1.5">
                {appts.length === 0 ? (
                  <div className="text-[12px] text-ink-subtle">No visits.</div>
                ) : (
                  appts.map((a) => (
                    <Link
                      key={a.id}
                      to={`/appointments/${a.id}`}
                      className="block rounded-md bg-brand-50 px-2 py-1.5 transition hover:bg-brand-100"
                    >
                      <div className="text-[12px] font-semibold text-brand-800 tabular-nums">
                        {timeFmt.format(new Date(a.startAt))}
                      </div>
                      <div className="mt-0.5 text-[11px] text-ink-muted">
                        #{a.patientId.slice(0, 6)}
                      </div>
                      <div className="mt-1.5">
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
