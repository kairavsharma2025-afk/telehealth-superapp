import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
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
  patientId: string;
  doctorId: string;
  startAt: string;
  endAt: string;
  status: "scheduled" | "confirmed" | "completed" | "cancelled";
  reason: string | null;
}
interface AppointmentsResult {
  items: Appointment[];
}

interface LookupItem {
  id: string;
  fullName: string | null;
  role: "patient" | "doctor" | "admin";
}
interface LookupResult {
  items: LookupItem[];
}

function titleCase(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export function UserDetailPage() {
  const { id } = useParams<{ id: string }>();

  // The admin /admin/users endpoint doesn't expose a /admin/users/:id —
  // we list and find. Fine for a directory of a few hundred users.
  const usersQuery = useQuery<UsersResult, ApiError>({
    queryKey: ["users", "all", true],
    queryFn: () => api<UsersResult>("/admin/users?includeInactive=true"),
    staleTime: 60_000,
  });

  const user = usersQuery.data?.items.find((u) => u.id === id);

  const appointmentsQuery = useQuery<AppointmentsResult, ApiError>({
    queryKey: ["user-appointments", id],
    queryFn: () => api<AppointmentsResult>("/appointments"),
    enabled: !!user,
    staleTime: 30_000,
  });

  const userAppointments = useMemo(() => {
    if (!user) return [];
    const all = appointmentsQuery.data?.items ?? [];
    return all
      .filter((a) =>
        user.role === "doctor" ? a.doctorId === user.id : a.patientId === user.id,
      )
      .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime())
      .slice(0, 20);
  }, [user, appointmentsQuery.data]);

  // Look up the counterparty (doctor for patients, patient for doctors)
  const counterpartyIds = useMemo(() => {
    if (!user) return [] as string[];
    const ids = new Set<string>();
    for (const a of userAppointments) {
      ids.add(user.role === "doctor" ? a.patientId : a.doctorId);
    }
    return Array.from(ids).sort();
  }, [user, userAppointments]);

  const lookupQuery = useQuery<LookupResult, ApiError>({
    queryKey: ["users-lookup", counterpartyIds.join(",")],
    queryFn: () =>
      api<LookupResult>(
        `/users/lookup?ids=${encodeURIComponent(counterpartyIds.join(","))}`,
      ),
    enabled: counterpartyIds.length > 0,
    staleTime: 5 * 60_000,
  });

  const lookupMap = useMemo(() => {
    const m = new Map<string, LookupItem>();
    for (const it of lookupQuery.data?.items ?? []) m.set(it.id, it);
    return m;
  }, [lookupQuery.data]);

  if (usersQuery.isPending) {
    return (
      <div className="card card-pad muted">Loading user…</div>
    );
  }
  if (!user) {
    return (
      <div>
        <header className="page-header">
          <h1>User not found</h1>
        </header>
        <div className="card card-pad">
          <p className="muted">
            We couldn't find a user with this id. They may have been removed.
          </p>
          <Link to="/users" className="btn-link">← Back to all users</Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <header className="page-header">
        <div>
          <Link to="/users" className="btn-link" style={{ marginBottom: 4, display: "inline-block" }}>
            ← All users
          </Link>
          <h1>{user.email}</h1>
        </div>
      </header>

      <div className="card card-pad" style={{ marginBottom: 24 }}>
        <div className="user-detail-grid">
          <DetailField label="Email" value={user.email} />
          <DetailField
            label="Role"
            value={
              <span className={`pill pill-${user.role}`}>{user.role}</span>
            }
          />
          <DetailField
            label="Status"
            value={
              <span
                className={`pill ${user.isActive ? "pill-active" : "pill-inactive"}`}
              >
                {user.isActive ? "Active" : "Inactive"}
              </span>
            }
          />
          <DetailField
            label="Joined"
            value={new Date(user.createdAt).toLocaleDateString(undefined, {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          />
          <DetailField label="User ID" value={<code>{user.id}</code>} />
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Recent appointments</h2>
          <span className="muted">
            {userAppointments.length}{" "}
            {userAppointments.length === 1 ? "appointment" : "appointments"}
          </span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>When</th>
              <th>{user.role === "doctor" ? "Patient" : "Doctor"}</th>
              <th>Status</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {appointmentsQuery.isPending ? (
              <tr>
                <td colSpan={4} className="muted" style={{ padding: 24 }}>
                  Loading…
                </td>
              </tr>
            ) : userAppointments.length === 0 ? (
              <tr>
                <td colSpan={4} className="muted" style={{ padding: 24 }}>
                  No appointments on record.
                </td>
              </tr>
            ) : (
              userAppointments.map((a) => {
                const partyId =
                  user.role === "doctor" ? a.patientId : a.doctorId;
                const info = lookupMap.get(partyId);
                const name = info?.fullName?.trim();
                let displayName: string;
                if (name) {
                  displayName =
                    info?.role === "doctor"
                      ? `Dr. ${titleCase(name)}`
                      : titleCase(name);
                } else {
                  displayName = "Unknown";
                }
                return (
                  <tr key={a.id}>
                    <td>
                      {new Date(a.startAt).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </td>
                    <td>{displayName}</td>
                    <td>
                      <span className={`pill pill-${a.status}`}>{a.status}</span>
                    </td>
                    <td className="muted">{a.reason ?? "—"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DetailField({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="user-detail-field">
      <div className="user-detail-label">{label}</div>
      <div className="user-detail-value">{value}</div>
    </div>
  );
}
