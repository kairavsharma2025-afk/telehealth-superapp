import { useMemo } from "react";
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
  // Pull every user (admin route gives us all of them) — needed to break
  // the count down by role.
  const usersQuery = useQuery<UsersResult, ApiError>({
    queryKey: ["users", "all", true],
    queryFn: () =>
      api<UsersResult>("/admin/users?includeInactive=true"),
    staleTime: 60_000,
  });

  // For appointments, pull a 60-day window around today — wide enough
  // for "today" + "currently confirmed" without dragging in years of
  // historical data.
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
    <div>
      <header className="page-header">
        <h1>Overview</h1>
        <div className="muted">A single-glance view of platform activity.</div>
      </header>

      {usersQuery.isError ? (
        <div className="alert alert-error">
          Couldn't load users: {usersQuery.error.message}
        </div>
      ) : null}
      {appointmentsQuery.isError ? (
        <div className="alert alert-error">
          Couldn't load appointments: {appointmentsQuery.error.message}
        </div>
      ) : null}

      <section style={{ marginBottom: 24 }}>
        <div className="section-label" style={{ marginBottom: 8 }}>People</div>
        <div className="kpi-grid">
          <Link to="/users" className="kpi brand-link">
            <span className="kpi-label">Total users</span>
            <span className="kpi-value">{isLoading ? "—" : userKpis.total}</span>
            <span className="kpi-delta">
              {userKpis.patients} patients · {userKpis.doctors} doctors ·{" "}
              {userKpis.admins} admins
            </span>
          </Link>
          <Link to="/users?role=patient" className="kpi">
            <span className="kpi-label">Patients</span>
            <span className="kpi-value">{isLoading ? "—" : userKpis.patients}</span>
          </Link>
          <Link to="/users?role=doctor" className="kpi">
            <span className="kpi-label">Doctors</span>
            <span className="kpi-value">{isLoading ? "—" : userKpis.doctors}</span>
          </Link>
          <Link to="/users?role=admin" className="kpi">
            <span className="kpi-label">Admins</span>
            <span className="kpi-value">{isLoading ? "—" : userKpis.admins}</span>
          </Link>
        </div>
      </section>

      <section>
        <div className="section-label" style={{ marginBottom: 8 }}>Appointments</div>
        <div className="kpi-grid">
          <Link to="/appointments?status=all" className="kpi brand-link">
            <span className="kpi-label">Today's appointments</span>
            <span className="kpi-value">{isLoading ? "—" : apptKpis.todayCount}</span>
            <span className="kpi-delta">Across the whole platform</span>
          </Link>
          <Link to="/appointments?status=confirmed" className="kpi">
            <span className="kpi-label">Currently confirmed</span>
            <span className="kpi-value">{isLoading ? "—" : apptKpis.confirmed}</span>
            <span className="kpi-delta">In the next 30 days</span>
          </Link>
          <Link to="/appointments?status=cancelled" className="kpi">
            <span className="kpi-label">Cancellation rate</span>
            <span className="kpi-value">
              {isLoading ? "—" : `${apptKpis.cancelRate}%`}
            </span>
            <span className="kpi-delta">±30 day window</span>
          </Link>
          <Link to="/appointments" className="kpi">
            <span className="kpi-label">All appointments</span>
            <span className="kpi-value">{isLoading ? "—" : appointments.length}</span>
            <span className="kpi-delta">In this window</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
