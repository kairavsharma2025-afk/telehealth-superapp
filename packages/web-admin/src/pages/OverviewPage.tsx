import { useMemo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, type ApiError } from "../lib/api";

interface User {
  id: string;
  email: string;
  role: "patient" | "doctor" | "admin";
  isActive: boolean;
  createdAt: string;
}
interface UsersResult {
  items: User[];
}
interface Appointment {
  id: string;
  startAt: string;
  status: "scheduled" | "confirmed" | "completed" | "cancelled";
}
interface AppointmentsResult {
  items: Appointment[];
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function OverviewPage() {
  const usersQuery = useQuery<UsersResult, ApiError>({
    queryKey: ["users", "all", true],
    queryFn: () => api<UsersResult>("/admin/users?includeInactive=true"),
    staleTime: 60_000,
  });

  const appointmentsQuery = useQuery<AppointmentsResult, ApiError>({
    queryKey: ["overview-appointments"],
    queryFn: () => {
      const now = new Date();
      const start = new Date(now);
      start.setDate(start.getDate() - 30);
      const end = new Date(now);
      end.setDate(end.getDate() + 30);
      const qs = new URLSearchParams({
        from: start.toISOString(),
        to: end.toISOString(),
      });
      return api<AppointmentsResult>(`/appointments?${qs.toString()}`);
    },
    staleTime: 30_000,
  });

  const users = usersQuery.data?.items ?? [];
  const appointments = appointmentsQuery.data?.items ?? [];

  const userKpis = useMemo(() => {
    const total = users.length;
    const patients = users.filter((u) => u.role === "patient").length;
    const doctors = users.filter((u) => u.role === "doctor").length;
    const admins = users.filter((u) => u.role === "admin").length;
    return { total, patients, doctors, admins };
  }, [users]);

  const apptKpis = useMemo(() => {
    const today = new Date();
    const todayCount = appointments.filter((a) =>
      isSameDay(new Date(a.startAt), today),
    ).length;
    const confirmed = appointments.filter((a) => a.status === "confirmed").length;
    const cancelled = appointments.filter((a) => a.status === "cancelled").length;
    const total = appointments.length;
    const cancelRate = total === 0 ? 0 : Math.round((cancelled / total) * 100);
    return { todayCount, confirmed, cancelRate };
  }, [appointments]);

  const isLoading = usersQuery.isPending || appointmentsQuery.isPending;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[22px] font-semibold tracking-tight text-ink">Overview</h1>
        <p className="mt-1 text-[13px] text-ink-muted">
          A single-glance view of platform activity.
        </p>
      </header>

      {usersQuery.isError ? (
        <Alert>Couldn&apos;t load users: {usersQuery.error.message}</Alert>
      ) : null}
      {appointmentsQuery.isError ? (
        <Alert>Couldn&apos;t load appointments: {appointmentsQuery.error.message}</Alert>
      ) : null}

      <section>
        <SectionLabel>People</SectionLabel>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi
            to="/users"
            label="Total users"
            value={isLoading ? "—" : userKpis.total}
            delta={`${userKpis.patients} patients · ${userKpis.doctors} doctors · ${userKpis.admins} admins`}
            primary
            icon={<UsersIcon />}
          />
          <Kpi
            to="/users?role=patient"
            label="Patients"
            value={isLoading ? "—" : userKpis.patients}
            icon={<UserIcon />}
          />
          <Kpi
            to="/users?role=doctor"
            label="Doctors"
            value={isLoading ? "—" : userKpis.doctors}
            icon={<StethoscopeIcon />}
          />
          <Kpi
            to="/users?role=admin"
            label="Admins"
            value={isLoading ? "—" : userKpis.admins}
            icon={<ShieldIcon />}
          />
        </div>
      </section>

      <section>
        <SectionLabel>Appointments</SectionLabel>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi
            to="/appointments?status=all"
            label="Today's appointments"
            value={isLoading ? "—" : apptKpis.todayCount}
            delta="Across the whole platform"
            primary
            icon={<CalendarIcon />}
          />
          <Kpi
            to="/appointments?status=confirmed"
            label="Currently confirmed"
            value={isLoading ? "—" : apptKpis.confirmed}
            delta="In the next 30 days"
            icon={<CheckIcon />}
          />
          <Kpi
            to="/appointments?status=cancelled"
            label="Cancellation rate"
            value={isLoading ? "—" : `${apptKpis.cancelRate}%`}
            delta="±30 day window"
            icon={<XCircleIcon />}
          />
          <Kpi
            to="/appointments"
            label="All appointments"
            value={isLoading ? "—" : appointments.length}
            delta="In this window"
            icon={<ListIcon />}
          />
        </div>
      </section>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-[10.5px] font-semibold uppercase tracking-wider text-ink-subtle">
      {children}
    </div>
  );
}

function Alert({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border border-danger/20 bg-danger-subtle px-3.5 py-2.5 text-[13px] text-danger">
      {children}
    </div>
  );
}

function Kpi({
  to,
  label,
  value,
  delta,
  primary = false,
  icon,
}: {
  to: string;
  label: string;
  value: number | string;
  delta?: string;
  primary?: boolean;
  icon?: ReactNode;
}) {
  return (
    <Link
      to={to}
      className={
        "group flex flex-col rounded-xl border bg-white p-4 transition hover:shadow-[0_1px_2px_0_rgba(15,23,42,0.05),0_4px_12px_-4px_rgba(15,23,42,0.06)] " +
        (primary ? "border-slate-300" : "border-border")
      }
    >
      <div className="flex items-center justify-between">
        {icon ? (
          <span
            className={
              "grid h-8 w-8 place-items-center rounded-lg " +
              (primary ? "bg-slate-900 text-white" : "bg-slate-100 text-ink-muted")
            }
          >
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
    </Link>
  );
}

function ArrowIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}
      aria-hidden="true">
      <path d="M5 11l6-6M5 5h6v6" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0Z M3 21a9 9 0 0 1 18 0" />
    </svg>
  );
}
function UserIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}
function StethoscopeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 3v6a4 4 0 0 0 8 0V3M9 13v3a5 5 0 0 0 10 0v-2M19 14a2 2 0 1 0-2-2" />
    </svg>
  );
}
function ShieldIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3 4 6v6c0 5 4 8 8 9 4-1 8-4 8-9V6l-8-3Z" />
    </svg>
  );
}
function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l3 3 5-6" />
    </svg>
  );
}
function XCircleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9l6 6M15 9l-6 6" />
    </svg>
  );
}
function ListIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}
