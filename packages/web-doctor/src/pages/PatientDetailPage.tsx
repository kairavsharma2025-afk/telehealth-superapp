import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, type ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Layout } from "../components/Layout";
import { StatusPill, type AppointmentStatus } from "../components/StatusPill";
import { formatRelative } from "../lib/countdown";

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
        <p>Missing patient id.</p>
      </Layout>
    );
  }

  return (
    <Layout
      title="Patient"
      meta={
        <Link to="/patients" className="muted">
          ← All patients
        </Link>
      }
    >
      <div className="identity-card">
        <div className="avatar">#{id.slice(0, 2).toUpperCase()}</div>
        <div>
          <div className="who">Patient · #{id.slice(0, 8)}</div>
          <div className="email">
            <code style={{ fontSize: 12 }}>{id}</code>
          </div>
          <span className="role-pill">patient</span>
        </div>
      </div>

      <div className="kpi-grid">
        <Stat label="Total visits" value={stats.total} brand />
        <Stat label="Completed" value={stats.completed} />
        <Stat label="Upcoming" value={stats.upcoming} />
        <Stat label="Cancelled" value={stats.cancelled} />
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Visit history</h2>
          <span className="muted">{appointments.length} with you</span>
        </div>
        {query.isPending ? (
          <div className="card-pad muted">Loading…</div>
        ) : appointments.length === 0 ? (
          <div className="card-pad muted">
            This patient hasn&apos;t booked with you. They may have been
            referred or seen by a different doctor.
          </div>
        ) : (
          <ul className="appt-list">
            {appointments.map((a) => (
              <li key={a.id}>
                <Link to={`/appointments/${a.id}`} className="appt-row">
                  <div className="appt-time" aria-hidden="true">
                    <span className="day">
                      {new Date(a.startAt)
                        .toLocaleDateString(undefined, { weekday: "short" })
                        .toUpperCase()}
                    </span>
                    <span className="time">
                      {new Date(a.startAt).toLocaleTimeString(undefined, {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                    <span className="date">
                      {new Date(a.startAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  <div className="appt-main">
                    <div className="who">
                      {longDate.format(new Date(a.startAt))}{" "}
                      <span className="muted">
                        · {formatRelative(new Date(a.startAt))}
                      </span>
                    </div>
                    <div className="reason">
                      {a.reason ?? "No reason provided"}
                      {a.notes ? (
                        <span className="muted"> · Notes attached</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="appt-side">
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
  brand: isBrand = false,
}: {
  label: string;
  value: number;
  brand?: boolean;
}) {
  return (
    <div className={`kpi${isBrand ? " brand" : ""}`}>
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
    </div>
  );
}
