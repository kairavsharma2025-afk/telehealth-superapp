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

  const patientLookup = useLookup(mine.map((a) => a.patientId));

  return (
    <Layout title="Dashboard" meta={<span>Today · {new Date().toLocaleDateString()}</span>}>
      {nextUp ? (
        <div className="mb-6 overflow-hidden rounded-xl border border-border bg-white shadow-[0_1px_2px_0_rgba(15,23,42,0.04)]">
          <div className="h-[3px] bg-brand-700" aria-hidden="true" />
          <div className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="text-[10.5px] font-semibold uppercase tracking-wider text-brand-700">
                Next up
              </div>
              <h2 className="mt-1 truncate text-[18px] font-semibold tracking-tight text-ink">
                {displayName(
                  nextUp.patientId,
                  patientLookup.get(nextUp.patientId),
                  "patient",
                )}
              </h2>
              <div className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-ink-muted">
                <KpiClockIcon />
                {nextUp.reason ? (
                  <>
                    <span>{nextUp.reason}</span>
                    <span className="text-ink-subtle">·</span>
                  </>
                ) : null}
                <span>{formatRelative(new Date(nextUp.startAt))}</span>
                <span className="text-ink-subtle">·</span>
                <span className="tabular-nums">
                  {new Date(nextUp.startAt).toLocaleTimeString(undefined, {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
            <div className="flex flex-shrink-0 items-center gap-2">
              {nextUp.status === "scheduled" ? (
                <button
                  onClick={() =>
                    transition.mutate({ id: nextUp.id, to: "confirmed" })
                  }
                  disabled={transition.isPending}
                  className="rounded-md bg-brand-700 px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-brand-800 disabled:opacity-60"
                >
                  Accept
                </button>
              ) : nextUp.status === "confirmed" ? (
                <button
                  onClick={() => navigate(`/consultation/${nextUp.id}`)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-brand-700 px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-brand-800"
                >
                  <PlayIcon size={12} />
                  Start consultation
                </button>
              ) : null}
              <Link
                to={`/appointments/${nextUp.id}`}
                className="rounded-md border border-border bg-white px-3.5 py-2 text-[13px] font-medium text-ink transition hover:bg-[#F6F8FA]"
              >
                View details
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi
          to="/appointments?filter=today"
          label="Today's queue"
          value={kpis.today}
          delta="Appointments today"
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
          {...(kpis.cancelRate === null ? { hint: "Not enough data yet" } : {})}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-[0_1px_2px_0_rgba(15,23,42,0.04)]">
        <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight text-ink">
              Appointments
            </h2>
            <div className="mt-0.5 text-[12px] text-ink-muted">
              {visible.length} {visible.length === 1 ? "appointment" : "appointments"}{" "}
              <span className="text-ink-subtle">·</span> {tabLabel(tab)}
            </div>
          </div>
          <div
            className="inline-flex flex-shrink-0 rounded-md border border-border bg-[#F6F8FA] p-0.5"
            role="tablist"
          >
            {(["today", "upcoming", "completed", "cancelled"] as const).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={
                  "rounded px-2.5 py-1 text-[12.5px] font-medium transition " +
                  (tab === t
                    ? "bg-white text-ink shadow-sm"
                    : "text-ink-muted hover:text-ink")
                }
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {query.isPending ? (
          <ul>
            <AppointmentRowSkeleton />
            <AppointmentRowSkeleton />
            <AppointmentRowSkeleton />
          </ul>
        ) : query.isError ? (
          <div className="px-5 py-4">
            <div className="rounded-md border border-danger/20 bg-danger-subtle px-3 py-2 text-[13px] text-danger">
              Couldn&apos;t load appointments — {query.error.message}.{" "}
              <button
                className="ml-1 font-medium underline"
                onClick={() => void query.refetch()}
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
          <ul>
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

const ACCENT_STYLES: Record<
  KpiAccent,
  { iconBg: string; iconText: string }
> = {
  teal: { iconBg: "bg-brand-50", iconText: "text-brand-700" },
  amber: { iconBg: "bg-amber-50", iconText: "text-amber-700" },
  green: { iconBg: "bg-emerald-50", iconText: "text-emerald-700" },
  red: { iconBg: "bg-rose-50", iconText: "text-rose-700" },
};

function Kpi({
  to,
  label,
  value,
  delta,
  hint,
  accent = "teal",
  icon,
}: {
  to: string;
  label: string;
  value: number | string;
  delta?: string;
  hint?: string;
  accent?: KpiAccent;
  icon?: ReactNode;
}) {
  const a = ACCENT_STYLES[accent];
  return (
    <Link
      to={to}
      title={hint}
      className="group flex flex-col rounded-xl border border-border bg-white p-4 transition hover:border-border-strong hover:shadow-[0_1px_2px_0_rgba(15,23,42,0.05),0_4px_12px_-4px_rgba(15,23,42,0.06)]"
    >
      <div className="flex items-center justify-between">
        {icon ? (
          <span className={`grid h-8 w-8 place-items-center rounded-lg ${a.iconBg} ${a.iconText}`}>
            {icon}
          </span>
        ) : null}
        <ArrowIcon className="text-ink-subtle opacity-0 transition group-hover:opacity-100" />
      </div>
      <span className="mt-3 text-[11.5px] font-medium uppercase tracking-wider text-ink-muted">
        {label}
      </span>
      <span className="mt-0.5 text-[26px] font-semibold tracking-tight text-ink tabular-nums">
        {value}
      </span>
      {delta ? <span className="mt-0.5 text-[11.5px] text-ink-muted">{delta}</span> : null}
      {hint && !delta ? <span className="mt-0.5 text-[11.5px] text-ink-muted">{hint}</span> : null}
    </Link>
  );
}

function ArrowIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M5 11l6-6M5 5h6v6" />
    </svg>
  );
}

function KpiCalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}
function KpiClockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
function KpiCheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l3 3 5-6" />
    </svg>
  );
}
function KpiXCircleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9l6 6M15 9l-6 6" />
    </svg>
  );
}

function EmptyIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 11h18" />
    </svg>
  );
}
