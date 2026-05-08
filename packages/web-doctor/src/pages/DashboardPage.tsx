import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Layout } from "../components/Layout";
import {
  AppointmentCard,
  type Appointment,
} from "../components/AppointmentCard";
import { type AppointmentStatus } from "../components/StatusPill";
import { EmptyState } from "../components/EmptyState";
import { AppointmentRowSkeleton } from "../components/Skeleton";
import { PlayIcon } from "../components/icons";
import { formatRelative } from "../lib/countdown";
import { displayName } from "../lib/queries";
import { useLookup } from "../lib/useLookup";

interface ListResult {
  items: Appointment[];
}

type Tab = "today" | "upcoming" | "completed" | "cancelled";

// Cancellation rate is meaningless until there's enough history to
// produce a stable signal — anything below this threshold renders as
// "—" with a "Not enough data yet" tooltip.
const CANCEL_RATE_MIN_SAMPLE = 5;

function listAppointments(): Promise<ListResult> {
  return api<ListResult>("/appointments");
}
function transitionAppointment(id: string, status: AppointmentStatus): Promise<Appointment> {
  return api<Appointment>(`/appointments/${id}`, { method: "PATCH", body: { status } });
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("today");

  const query = useQuery<ListResult, ApiError>({
    queryKey: ["appointments"],
    queryFn: listAppointments,
  });

  const transition = useMutation<
    Appointment,
    ApiError,
    { id: string; to: AppointmentStatus },
    { previous: ListResult | undefined }
  >({
    mutationFn: ({ id, to }) => transitionAppointment(id, to),
    onMutate: async ({ id, to }) => {
      await qc.cancelQueries({ queryKey: ["appointments"] });
      const previous = qc.getQueryData<ListResult>(["appointments"]);
      qc.setQueryData<ListResult>(["appointments"], (old) =>
        old
          ? {
              items: old.items.map((a) => (a.id === id ? { ...a, status: to } : a)),
            }
          : old,
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(["appointments"], ctx.previous);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["appointments"] });
    },
  });

  const mine = useMemo(
    () => (query.data?.items ?? []).filter((a) => a.doctorId === user?.id),
    [query.data, user?.id],
  );

  const buckets = useMemo(() => {
    const today = new Date();
    return {
      today: mine.filter(
        (a) =>
          isSameDay(new Date(a.startAt), today) &&
          a.status !== "completed" &&
          a.status !== "cancelled",
      ),
      upcoming: mine.filter(
        (a) =>
          new Date(a.startAt) > today &&
          !isSameDay(new Date(a.startAt), today) &&
          a.status !== "cancelled",
      ),
      completed: mine.filter((a) => a.status === "completed"),
      cancelled: mine.filter((a) => a.status === "cancelled"),
    };
  }, [mine]);

  const visible = buckets[tab];

  const kpis = useMemo(() => {
    const cancelledCount = buckets.cancelled.length;
    const totalSample = mine.length;
    const cancelRate =
      totalSample < CANCEL_RATE_MIN_SAMPLE
        ? null
        : Math.round((cancelledCount / totalSample) * 100);
    return {
      today: buckets.today.length,
      pending: mine.filter((a) => a.status === "scheduled").length,
      completed: buckets.completed.length,
      cancelRate,
    };
  }, [buckets, mine]);

  const nextUp = useMemo(() => {
    const now = Date.now();
    return mine
      .filter(
        (a) =>
          a.status !== "cancelled" &&
          a.status !== "completed" &&
          new Date(a.endAt).getTime() > now,
      )
      .sort(
        (a, b) =>
          new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
      )[0];
  }, [mine]);

  // Resolve patient names for the Next-up hero + every visible row.
  const patientLookup = useLookup(mine.map((a) => a.patientId));

  return (
    <Layout title="Dashboard" meta={<span>Today · {new Date().toLocaleDateString()}</span>}>
      {nextUp ? (
        <div className="next-up">
          <div>
            <span className="label">Next up</span>
            <h2>
              {displayName(
                nextUp.patientId,
                patientLookup.get(nextUp.patientId),
                "patient",
              )}
            </h2>
            <span className="countdown">
              <KpiClockIcon />
              {nextUp.reason ? `${nextUp.reason} · ` : ""}
              {formatRelative(new Date(nextUp.startAt))} ·{" "}
              {new Date(nextUp.startAt).toLocaleTimeString(undefined, {
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          </div>
          <div className="next-up-actions">
            {nextUp.status === "scheduled" ? (
              <button
                className="next-up-cta-primary"
                onClick={() =>
                  transition.mutate({ id: nextUp.id, to: "confirmed" })
                }
                disabled={transition.isPending}
              >
                Accept
              </button>
            ) : nextUp.status === "confirmed" ? (
              <button
                className="next-up-cta-primary"
                onClick={() => navigate(`/consultation/${nextUp.id}`)}
              >
                <PlayIcon size={12} />
                Start consultation
              </button>
            ) : null}
            <Link
              to={`/appointments/${nextUp.id}`}
              className="next-up-cta-ghost"
            >
              View details
            </Link>
          </div>
        </div>
      ) : null}

      <div className="kpi-grid">
        <Kpi
          to="/appointments?filter=today"
          label="Today's queue"
          value={kpis.today}
          delta="Appointments today"
          brand
          accent="teal"
          icon={<KpiCalendarIcon />}
        />
        <Kpi
          to="/appointments?filter=awaiting"
          label="Awaiting confirmation"
          value={kpis.pending}
          delta="Needs your review"
          accent="amber"
          icon={<KpiClockIcon />}
        />
        <Kpi
          to="/appointments?tab=completed"
          label="Completed (all-time)"
          value={kpis.completed}
          accent="green"
          icon={<KpiCheckIcon />}
        />
        <Kpi
          to="/appointments?tab=cancelled"
          label="Cancellation rate"
          value={kpis.cancelRate === null ? "—" : `${kpis.cancelRate}%`}
          accent="red"
          icon={<KpiXCircleIcon />}
          {...(kpis.cancelRate === null
            ? { hint: "Not enough data yet" }
            : {})}
        />
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <h2>Appointments</h2>
            <div className="muted" style={{ marginTop: 2 }}>
              {visible.length} {visible.length === 1 ? "appointment" : "appointments"}{" "}
              <span className="muted">·</span> {tabLabel(tab)}
            </div>
          </div>
          <div className="tabs" role="tablist">
            {(["today", "upcoming", "completed", "cancelled"] as const).map(
              (t) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={tab === t}
                  className={tab === t ? "active" : ""}
                  onClick={() => setTab(t)}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ),
            )}
          </div>
        </div>

        {query.isPending ? (
          <ul className="appt-list">
            <AppointmentRowSkeleton />
            <AppointmentRowSkeleton />
            <AppointmentRowSkeleton />
          </ul>
        ) : query.isError ? (
          <div className="card-pad">
            <div className="alert alert-error">
              Couldn&apos;t load appointments — {query.error.message}.{" "}
              <button
                className="link"
                onClick={() => void query.refetch()}
                style={{ marginLeft: 8 }}
              >
                Retry
              </button>
            </div>
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<EmptyIcon />}
            title={emptyTitle(tab)}
            description={emptyDescription(tab)}
          />
        ) : (
          <ul className="appt-list">
            {visible.map((appointment) => (
              <AppointmentCard
                key={appointment.id}
                appointment={appointment}
                patient={patientLookup.get(appointment.patientId)}
                busy={transition.isPending}
                onTransition={(to) => transition.mutate({ id: appointment.id, to })}
              />
            ))}
          </ul>
        )}
      </div>
    </Layout>
  );
}

function tabLabel(tab: Tab): string {
  switch (tab) {
    case "today": return "scheduled today";
    case "upcoming": return "scheduled later";
    case "completed": return "completed";
    case "cancelled": return "cancelled";
  }
}
function emptyTitle(tab: Tab): string {
  switch (tab) {
    case "today": return "No appointments today";
    case "upcoming": return "Nothing scheduled yet";
    case "completed": return "No completed visits";
    case "cancelled": return "No cancellations";
  }
}
function emptyDescription(tab: Tab): string {
  switch (tab) {
    case "today": return "Your queue is clear. New bookings will appear here automatically.";
    case "upcoming": return "Patients booking with you will land in this list.";
    case "completed": return "Once you mark visits complete, they show up here.";
    case "cancelled": return "Cancelled visits will collect here for your records.";
  }
}

type KpiAccent = "teal" | "amber" | "green" | "red";

function Kpi({
  to,
  label,
  value,
  delta,
  hint,
  brand: isBrand = false,
  accent,
  icon,
}: {
  to: string;
  label: string;
  value: number | string;
  delta?: string;
  hint?: string;
  brand?: boolean;
  accent?: KpiAccent;
  icon?: ReactNode;
}) {
  const cls = ["kpi"];
  if (isBrand) cls.push("brand");
  if (accent) cls.push(`kpi-accent-${accent}`);
  return (
    <Link to={to} className={cls.join(" ")} title={hint}>
      {icon ? <span className={`kpi-icon kpi-icon-${accent ?? "teal"}`}>{icon}</span> : null}
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
      {delta ? <span className="kpi-delta">{delta}</span> : null}
      {hint && !delta ? <span className="kpi-delta">{hint}</span> : null}
    </Link>
  );
}

function KpiCalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}
function KpiClockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
function KpiCheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l3 3 5-6" />
    </svg>
  );
}
function KpiXCircleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9l6 6M15 9l-6 6" />
    </svg>
  );
}

function EmptyIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 11h18" />
    </svg>
  );
}
