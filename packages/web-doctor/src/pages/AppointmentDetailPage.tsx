import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ApiError } from "../lib/api";
import { Layout } from "../components/Layout";
import { StatusPill, type AppointmentStatus } from "../components/StatusPill";
import { Skeleton } from "../components/Skeleton";
import { PlayIcon } from "../components/icons";
import { useEscapeKey, useToast } from "../lib/toast";
import { formatRelative } from "../lib/countdown";
import { displayName } from "../lib/queries";
import { useLookup } from "../lib/useLookup";

interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  startAt: string;
  endAt: string;
  status: AppointmentStatus;
  reason: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

const fullDate = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});
const timeFmt = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});

export function AppointmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [confirmCancel, setConfirmCancel] = useState(false);

  const query = useQuery<Appointment, ApiError>({
    queryKey: ["appointments", id],
    queryFn: () => api<Appointment>(`/appointments/${id ?? ""}`),
    enabled: !!id,
  });

  // Resolve the patient's display name. The hook tolerates an empty
  // array, so the call is safe before the appointment loads.
  const patientLookup = useLookup(query.data ? [query.data.patientId] : []);

  const transition = useMutation<
    Appointment,
    ApiError,
    AppointmentStatus,
    { previous: Appointment | undefined }
  >({
    mutationFn: (status) =>
      api<Appointment>(`/appointments/${id ?? ""}`, {
        method: "PATCH",
        body: { status },
      }),
    onMutate: async (status) => {
      await qc.cancelQueries({ queryKey: ["appointments", id] });
      const previous = qc.getQueryData<Appointment>(["appointments", id]);
      qc.setQueryData<Appointment>(["appointments", id], (old) =>
        old ? { ...old, status } : old,
      );
      return { previous };
    },
    onError: (err, _status, ctx) => {
      if (ctx?.previous) qc.setQueryData(["appointments", id], ctx.previous);
      toast.push({ tone: "error", title: "Action failed", description: err.message });
    },
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ["appointments"] });
      toast.push({
        tone: "success",
        title: `Appointment ${data.status}`,
      });
    },
  });

  if (!id) {
    return (
      <Layout title="Appointment">
        <p>Missing id.</p>
      </Layout>
    );
  }

  if (query.isPending) {
    return (
      <Layout title="Appointment">
        <div className="detail-grid">
          <div className="detail-section">
            <h3>
              <Skeleton width={160} height={16} />
            </h3>
            <div className="body">
              <Skeleton height={80} />
            </div>
          </div>
          <div className="detail-section">
            <h3>
              <Skeleton width={120} height={16} />
            </h3>
            <div className="body">
              <Skeleton height={120} />
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (query.isError || !query.data) {
    return (
      <Layout title="Appointment">
        <div className="alert alert-error">
          Couldn&apos;t load this appointment — {query.error?.message ?? "unknown"}.{" "}
          <Link to="/appointments" style={{ marginLeft: 8 }}>
            Back to list
          </Link>
        </div>
      </Layout>
    );
  }

  const a = query.data;
  const start = new Date(a.startAt);
  const end = new Date(a.endAt);
  const created = new Date(a.createdAt);
  const updated = new Date(a.updatedAt);
  const canConfirm = a.status === "scheduled";
  const canComplete = a.status === "confirmed";
  const canCancel = a.status === "scheduled" || a.status === "confirmed";
  const canStartConsult = a.status === "confirmed";

  return (
    <Layout
      title="Appointment"
      meta={
        <Link to="/appointments" className="muted">
          ← All appointments
        </Link>
      }
    >
      <div className="detail-grid">
        <div>
          <div className="detail-section" style={{ marginBottom: 16 }}>
            <h3>Visit</h3>
            <div className="body">
              <div
                className="row-spread"
                style={{ marginBottom: 16, alignItems: "flex-start" }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 22,
                      fontWeight: 600,
                      marginBottom: 4,
                    }}
                  >
                    {fullDate.format(start)}
                  </div>
                  <div className="muted">
                    {timeFmt.format(start)} – {timeFmt.format(end)} ·{" "}
                    {formatRelative(start)}
                  </div>
                </div>
                <StatusPill status={a.status} />
              </div>

              <dl className="prop-list">
                <dt>Patient</dt>
                <dd>
                  <strong>
                    {displayName(a.patientId, patientLookup.get(a.patientId), "patient")}
                  </strong>{" "}
                  <span className="muted" style={{ fontSize: 12 }}>
                    #{a.patientId.slice(0, 8)}
                  </span>
                  <Link
                    to={`/patients/${a.patientId}`}
                    style={{ marginLeft: 10, fontSize: 13 }}
                  >
                    View patient record
                  </Link>
                </dd>
                <dt>Reason</dt>
                <dd>{a.reason ?? <span className="muted">— not provided</span>}</dd>
                <dt>Booked</dt>
                <dd>
                  {fullDate.format(created)} · {formatRelative(created)}
                </dd>
                <dt>Last updated</dt>
                <dd>{formatRelative(updated)}</dd>
              </dl>
            </div>
          </div>

          <div className="detail-section">
            <h3>Clinical notes</h3>
            <div className="body">
              {a.notes ? (
                <pre
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 13,
                    whiteSpace: "pre-wrap",
                    margin: 0,
                    color: "var(--color-text)",
                  }}
                >
                  {a.notes}
                </pre>
              ) : (
                <p className="muted" style={{ margin: 0 }}>
                  No notes yet. Start a consultation to capture clinical observations,
                  diagnoses, and follow-up actions.
                </p>
              )}
            </div>
          </div>
        </div>

        <div>
          <div className="detail-section" style={{ marginBottom: 16 }}>
            <h3>Actions</h3>
            <div className="body stack-3">
              {canStartConsult ? (
                <button
                  onClick={() => navigate(`/consultation/${a.id}`)}
                  style={{ width: "100%" }}
                >
                  <PlayIcon size={12} />
                  Start consultation
                </button>
              ) : null}
              {canConfirm ? (
                <button
                  onClick={() => transition.mutate("confirmed")}
                  disabled={transition.isPending}
                  style={{ width: "100%" }}
                >
                  ✓ Accept booking
                </button>
              ) : null}
              {canComplete && !canStartConsult ? (
                <button
                  className="secondary"
                  onClick={() => transition.mutate("completed")}
                  disabled={transition.isPending}
                  style={{ width: "100%" }}
                >
                  Mark complete
                </button>
              ) : null}
              {canCancel ? (
                <button
                  className="danger"
                  onClick={() => setConfirmCancel(true)}
                  disabled={transition.isPending}
                  style={{ width: "100%" }}
                >
                  {a.status === "scheduled" ? "Reject booking" : "Cancel"}
                </button>
              ) : null}
              {!canConfirm && !canComplete && !canCancel ? (
                <p className="muted" style={{ margin: 0 }}>
                  This appointment is{" "}
                  {a.status === "completed" ? "complete" : "cancelled"}.
                </p>
              ) : null}
            </div>
          </div>

          <div className="detail-section">
            <h3>Timeline</h3>
            <div className="body">
              <ul className="timeline">
                <li>
                  <span className="when">
                    {created.toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className="what">Booking received</span>
                </li>
                {a.status !== "scheduled" ? (
                  <li className={a.status === "cancelled" ? "muted" : ""}>
                    <span className="when">
                      {updated.toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                    <span className="what">
                      {a.status === "confirmed"
                        ? "Confirmed by you"
                        : a.status === "completed"
                          ? "Consultation completed"
                          : "Cancelled"}
                    </span>
                  </li>
                ) : null}
                <li className="muted">
                  <span className="when">
                    {start.toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className="what">Scheduled visit time</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {confirmCancel ? (
        <ConfirmCancel
          status={a.status}
          onClose={() => setConfirmCancel(false)}
          onConfirm={() => {
            transition.mutate("cancelled");
            setConfirmCancel(false);
          }}
          busy={transition.isPending}
        />
      ) : null}
    </Layout>
  );
}

function ConfirmCancel({
  status,
  onClose,
  onConfirm,
  busy,
}: {
  status: AppointmentStatus;
  onClose: () => void;
  onConfirm: () => void;
  busy: boolean;
}) {
  useEscapeKey(onClose);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <h2>
          {status === "scheduled" ? "Reject this booking?" : "Cancel this appointment?"}
        </h2>
        <p>The patient will be notified.</p>
        <div className="modal-actions">
          <button className="secondary" onClick={onClose} disabled={busy}>
            Go back
          </button>
          <button className="danger" onClick={onConfirm} disabled={busy}>
            {status === "scheduled" ? "Yes, reject" : "Yes, cancel"}
          </button>
        </div>
      </div>
    </div>
  );
}
