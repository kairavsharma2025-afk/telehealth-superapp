import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, type ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Layout } from "../components/Layout";
import { StatusPill, type AppointmentStatus } from "../components/StatusPill";
import { formatRelative } from "../lib/countdown";
import { displayName } from "../lib/queries";
import { useLookup } from "../lib/useLookup";

interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  startAt: string;
  endAt: string;
  status: AppointmentStatus;
  reason: string | null;
  notes: string | null;
}
interface ListResult {
  items: Appointment[];
}

const longDate = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const query = useQuery<ListResult, ApiError>({
    queryKey: ["appointments"],
    queryFn: () => api<ListResult>("/appointments"),
  });
  const lookup = useLookup(id ? [id] : []);
  const patientInfo = id ? lookup.get(id) : undefined;
  const patientName = id ? displayName(id, patientInfo, "patient") : "Patient";
  const initials = patientInfo?.fullName
    ? patientInfo.fullName
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w.charAt(0).toUpperCase())
        .join("")
    : "??";

  const appointments = useMemo(() => {
    if (!id) return [];
    return (query.data?.items ?? [])
      .filter((a) => a.patientId === id && a.doctorId === user?.id)
      .sort(
        (a, b) =>
          new Date(b.startAt).getTime() - new Date(a.startAt).getTime(),
      );
  }, [query.data, id, user?.id]);

  const stats = useMemo(() => {
    const now = Date.now();
    return {
      total: appointments.length,
      completed: appointments.filter((a) => a.status === "completed").length,
      upcoming: appointments.filter(
        (a) =>
          a.status !== "cancelled" &&
          a.status !== "completed" &&
          new Date(a.endAt).getTime() > now,
      ).length,
      cancelled: appointments.filter((a) => a.status === "cancelled").length,
    };
  }, [appointments]);

  if (!id) {
    return (
      <Layout title="Patient">
        <p className="text-[13px] text-ink-muted">Missing patient id.</p>
      </Layout>
    );
  }

  const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: "short" });
  const monthDayFmt = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
  const timeFmt = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

  return (
    <Layout
      title="Patient"
      meta={
        <Link to="/patients" className="text-[12.5px] text-ink-muted hover:text-ink">
          ← All patients
        </Link>
      }
    >
      <div className="mb-6 flex items-center gap-4 rounded-xl border border-border bg-white p-5 shadow-[0_1px_2px_0_rgba(15,23,42,0.04)]">
        <div className="grid h-14 w-14 flex-shrink-0 place-items-center rounded-full bg-brand-100 text-[16px] font-semibold text-brand-800">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[18px] font-semibold tracking-tight text-ink">
            {patientName}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[11.5px] text-ink-muted">
              #{id.slice(0, 8)}
            </code>
            <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold capitalize text-blue-700 ring-1 ring-blue-200">
              patient
            </span>
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total visits" value={stats.total} primary />
        <Stat label="Completed" value={stats.completed} />
        <Stat label="Upcoming" value={stats.upcoming} />
        <Stat label="Cancelled" value={stats.cancelled} />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-[0_1px_2px_0_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-[15px] font-semibold tracking-tight text-ink">
            Visit history
          </h2>
          <span className="text-[12.5px] text-ink-muted">
            {appointments.length} with you
          </span>
        </div>
        {query.isPending ? (
          <div className="px-5 py-12 text-center text-[13px] text-ink-muted">
            Loading…
          </div>
        ) : appointments.length === 0 ? (
          <div className="px-5 py-12 text-center text-[13px] text-ink-muted">
            This patient hasn&apos;t booked with you. They may have been referred or seen
            by a different doctor.
          </div>
        ) : (
          <ul>
            {appointments.map((a) => (
              <li key={a.id}>
                <Link
                  to={`/appointments/${a.id}`}
                  className="flex items-center gap-4 border-b border-border px-4 py-3 last:border-b-0 transition hover:bg-[#FBFCFD]"
                >
                  <div
                    className="flex h-[58px] w-[72px] flex-shrink-0 flex-col items-center justify-center rounded-lg border border-border bg-[#FBFCFD] leading-tight"
                    aria-hidden="true"
                  >
                    <span className="text-[10.5px] font-semibold uppercase tracking-wider text-ink-subtle">
                      {dayFmt.format(new Date(a.startAt))}
                    </span>
                    <span className="mt-0.5 text-[14px] font-semibold text-ink tabular-nums">
                      {timeFmt.format(new Date(a.startAt))}
                    </span>
                    <span className="text-[10.5px] text-ink-muted">
                      {monthDayFmt.format(new Date(a.startAt))}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-medium text-ink">
                      {longDate.format(new Date(a.startAt))}
                      <span className="ml-1.5 text-[12px] font-normal text-ink-subtle">
                        · {formatRelative(new Date(a.startAt))}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-[12.5px] text-ink-muted">
                      {a.reason ?? "No reason provided"}
                      {a.notes ? (
                        <span className="ml-1 text-ink-subtle">· Notes attached</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <StatusPill status={a.status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Layout>
  );
}

function Stat({
  label,
  value,
  primary = false,
}: {
  label: string;
  value: number;
  primary?: boolean;
}) {
  return (
    <div
      className={
        "flex flex-col rounded-xl border bg-white p-4 " +
        (primary ? "border-brand-200" : "border-border")
      }
    >
      <span className="text-[11.5px] font-medium uppercase tracking-wider text-ink-muted">
        {label}
      </span>
      <span className="mt-2 text-[26px] font-semibold tracking-tight text-ink tabular-nums">
        {value}
      </span>
    </div>
  );
}
