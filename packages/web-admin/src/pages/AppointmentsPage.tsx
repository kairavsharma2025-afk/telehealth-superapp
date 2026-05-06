import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../lib/api";

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
  const e = new Date(endAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
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

  return (
    <div>
      <header className="page-header">
        <h1>All appointments</h1>
        <div className="muted">{items.length} total</div>
      </header>

      {query.isPending ? <p>Loading…</p> : null}
      {query.isError ? <p className="error">Failed: {query.error.message}</p> : null}

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
          {items.map((a) => (
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
          ))}
        </tbody>
      </table>

      {cancelMut.isError ? (
        <p className="error">Cancel failed: {cancelMut.error.message}</p>
      ) : null}
    </div>
  );
}
