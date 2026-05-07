import { useMemo, useState } from "react";
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
import { formatRelative } from "../lib/countdown";

interface ListResult {
  items: Appointment[];
}

type Tab = "today" | "upcoming" | "completed";

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

  // Optimistic update on transitions — UI flips status immediately, the
  // network round-trip happens in the background. On error we roll back.
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
    };
  }, [mine]);

  const visible = buckets[tab];

  const kpis = useMemo(() => {
    return {
      today: buckets.today.length,
      pending: mine.filter((a) => a.status === "scheduled").length,
      completed: buckets.completed.length,
      cancelRate: rate(mine.filter((a) => a.status === "cancelled").length, mine.length),
    };
  }, [buckets, mine]);

  // "Next up" — first non-terminal appointment by start time. Drives
  // the hero widget so the doctor sees their next visit + a quick CTA
  // the moment they land on the dashboard.
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

  return (
    <Layout title="Dashboard" meta={<span>Today · {new Date().toLocaleDateString()}</span>}>
      {nextUp ? (
        <div className="next-up">
          <div>
            <span className="label">Next up</span>
            <h2>Patient #{nextUp.patientId.slice(0, 8)}</h2>
            <span className="countdown">
              {nextUp.reason ? `${nextUp.reason} · ` : ""}
              {formatRelative(new Date(nextUp.startAt))} ·{" "}
              {new Date(nextUp.startAt).toLocaleTimeString(undefined, {
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Link
              to={`/appointments/${nextUp.id}`}
              className="btn"
              style={{ background: "rgba(255,255,255,0.16)", borderColor: "transparent" }}
            >
              View details
            </Link>
            {nextUp.status === "scheduled" ? (
              <button
                onClick={() =>
                  transition.mutate({ id: nextUp.id, to: "confirmed" })
                }
                disabled={transition.isPending}
              >
                Accept
              </button>
            ) : nextUp.status === "confirmed" ? (
              <button
                onClick={() => navigate(`/consultation/${nextUp.id}`)}
              >
                ▶ Start consultation
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="kpi-grid">
        <Kpi label="Today's queue" value={kpis.today} brand />
        <Kpi label="Awaiting confirmation" value={kpis.pending} delta="Needs your review" />
        <Kpi label="Completed (all-time)" value={kpis.completed} />
        <Kpi label="Cancellation rate" value={`${kpis.cancelRate}%`} />
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
            <button
              role="tab"
              aria-selected={tab === "today"}
              className={tab === "today" ? "active" : ""}
              onClick={() => setTab("today")}
            >
              Today
            </button>
            <button
              role="tab"
              aria-selected={tab === "upcoming"}
              className={tab === "upcoming" ? "active" : ""}
              onClick={() => setTab("upcoming")}
            >
              Upcoming
            </button>
            <button
              role="tab"
              aria-selected={tab === "completed"}
              className={tab === "completed" ? "active" : ""}
              onClick={() => setTab("completed")}
            >
              Completed
            </button>
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

function rate(count: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((count / total) * 100);
}

function tabLabel(tab: Tab): string {
  switch (tab) {
    case "today": return "scheduled today";
    case "upcoming": return "scheduled later";
    case "completed": return "completed";
  }
}
function emptyTitle(tab: Tab): string {
  switch (tab) {
    case "today": return "No appointments today";
    case "upcoming": return "Nothing scheduled yet";
    case "completed": return "No completed visits";
  }
}
function emptyDescription(tab: Tab): string {
  switch (tab) {
    case "today": return "Your queue is clear. New bookings will appear here automatically.";
    case "upcoming": return "Patients booking with you will land in this list.";
    case "completed": return "Once you mark visits complete, they show up here.";
  }
}

function Kpi({
  label,
  value,
  delta,
  brand: isBrand = false,
}: {
  label: string;
  value: number | string;
  delta?: string;
  brand?: boolean;
}) {
  return (
    <div className={`kpi${isBrand ? " brand" : ""}`}>
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
      {delta ? <span className="kpi-delta">{delta}</span> : null}
    </div>
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
