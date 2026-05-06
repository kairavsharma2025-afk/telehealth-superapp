import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";

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

type TransitionTarget = "confirmed" | "completed" | "cancelled";

function listAppointments(): Promise<ListResult> {
  return api<ListResult>("/appointments");
}

function transitionAppointment(id: string, status: TransitionTarget): Promise<Appointment> {
  return api<Appointment>(`/appointments/${id}`, {
    method: "PATCH",
    body: { status },
  });
}

function formatRange(startAt: string, endAt: string): string {
  const fmt: Intl.DateTimeFormatOptions = {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  };
  const s = new Date(startAt).toLocaleString(undefined, fmt);
  const e = new Date(endAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${s} → ${e}`;
}

export function DashboardPage() {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery<ListResult, ApiError>({
    queryKey: ["appointments"],
    queryFn: listAppointments,
  });

  const transition = useMutation<Appointment, ApiError, { id: string; to: TransitionTarget }>({
    mutationFn: ({ id, to }) => transitionAppointment(id, to),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["appointments"] }),
  });

  const myAppointments = (query.data?.items ?? []).filter((a) => a.doctorId === user?.id);

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <strong>{user?.email}</strong> <span className="role">{user?.role}</span>
        </div>
        <button onClick={logout} className="link">
          Sign out
        </button>
      </header>

      <main>
        <h1>Appointments</h1>

        {query.isPending ? <p>Loading…</p> : null}
        {query.isError ? <p className="error">Failed to load: {query.error.message}</p> : null}

        {query.data && myAppointments.length === 0 ? (
          <p className="muted">No appointments yet.</p>
        ) : null}

        <ul className="list">
          {myAppointments.map((a) => (
            <li key={a.id} className={`row status-${a.status}`}>
              <div className="row-main">
                <div className="when">{formatRange(a.startAt, a.endAt)}</div>
                <div className="who">patient {a.patientId.slice(0, 8)}…</div>
                {a.reason ? <div className="reason">{a.reason}</div> : null}
              </div>
              <div className="row-side">
                <span className={`pill pill-${a.status}`}>{a.status}</span>
                {a.status === "scheduled" ? (
                  <button
                    onClick={() => transition.mutate({ id: a.id, to: "confirmed" })}
                    disabled={transition.isPending}
                  >
                    Confirm
                  </button>
                ) : null}
                {a.status === "confirmed" ? (
                  <button
                    onClick={() => transition.mutate({ id: a.id, to: "completed" })}
                    disabled={transition.isPending}
                  >
                    Complete
                  </button>
                ) : null}
                {(a.status === "scheduled" || a.status === "confirmed") ? (
                  <button
                    className="danger"
                    onClick={() => transition.mutate({ id: a.id, to: "cancelled" })}
                    disabled={transition.isPending}
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>

        {transition.isError ? (
          <p className="error">Action failed: {transition.error.message}</p>
        ) : null}
      </main>
    </div>
  );
}
