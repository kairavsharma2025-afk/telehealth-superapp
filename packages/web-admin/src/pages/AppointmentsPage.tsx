import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ApiError } from "../lib/api";

interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  startAt: string;
  endAt: string;
  status: "scheduled" | "confirmed" | "completed" | "cancelled";
  reason: string | null;
}
interface ListResult {
  items: Appointment[];
}

function listAll(): Promise<ListResult> {
  return api<ListResult>("/appointments");
}

function cancel(id: string): Promise<Appointment> {
  return api<Appointment>(`/appointments/${id}`, {
    method: "PATCH",
    body: { status: "cancelled" },
  });
}

function fmtRange(startAt: string, endAt: string): string {
  const fmt: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  };
  const s = new Date(startAt).toLocaleString(undefined, fmt);
  const e = new Date(endAt).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${s} → ${e}`;
}

export function AppointmentsPage() {
  const queryClient = useQueryClient();

  const query = useQuery<ListResult, ApiError>({
    queryKey: ["all-appointments"],
    queryFn: listAll,
  });

  const cancelMut = useMutation<Appointment, ApiError, string>({
    mutationFn: (id) => cancel(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["all-appointments"] }),
  });

  const items = query.data?.items ?? [];

  const kpis = useMemo(() => {
    const total = items.length;
    const today = new Date();
    return {
      total,
      today: items.filter((a) => isSameDay(new Date(a.startAt), today)).length,
      confirmed: items.filter((a) => a.status === "confirmed").length,
      cancelRate:
        total === 0
          ? 0
          : Math.round((items.filter((a) => a.status === "cancelled").length / total) * 100),
    };
  }, [items]);

  return (
    <div>
      <header className="page-header">
        <h1>Appointments</h1>
        <div className="muted">{items.length} total across the platform</div>
      </header>

      <div className="kpi-grid">
        <Kpi label="Total appointments" value={kpis.total} brand />
        <Kpi label="Today" value={kpis.today} />
        <Kpi label="Currently confirmed" value={kpis.confirmed} />
        <Kpi label="Cancellation rate" value={`${kpis.cancelRate}%`} />
      </div>

      {query.isError ? (
        <div className="alert alert-error">Failed to load: {query.error.message}</div>
      ) : null}
      {cancelMut.isError ? (
        <div className="alert alert-error">Cancel failed: {cancelMut.error.message}</div>
      ) : null}

      <div className="card">
        <div className="card-header">
          <h2>All appointments</h2>
          <span className="muted">{items.length} rows</span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Patient</th>
              <th>Doctor</th>
              <th>Reason</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {query.isPending ? (
              <tr>
                <td colSpan={6} className="muted" style={{ padding: 24 }}>
                  Loading…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted" style={{ padding: 24 }}>
                  No appointments yet.
                </td>
              </tr>
            ) : (
              items.map((a) => (
                <tr key={a.id}>
                  <td>{fmtRange(a.startAt, a.endAt)}</td>
                  <td className="mono">{a.patientId.slice(0, 8)}…</td>
                  <td className="mono">{a.doctorId.slice(0, 8)}…</td>
                  <td className="muted">{a.reason ?? "—"}</td>
                  <td>
                    <span className={`pill pill-${a.status}`}>{a.status}</span>
                  </td>
                  <td className="actions">
                    {a.status === "scheduled" || a.status === "confirmed" ? (
                      <button
                        className="danger"
                        disabled={cancelMut.isPending}
                        onClick={() => cancelMut.mutate(a.id)}
                      >
                        Force cancel
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function Kpi({
  label,
  value,
  brand: isBrand = false,
}: {
  label: string;
  value: number | string;
  brand?: boolean;
}) {
  return (
    <div className={`kpi${isBrand ? " brand" : ""}`}>
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
    </div>
  );
}
