import { useState, type ReactNode } from "react";
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
        <p className="text-[13px] text-ink-muted">Missing id.</p>
      </Layout>
    );
  }

  if (query.isPending) {
    return (
      <Layout title="Appointment">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          <Card>
            <CardHeader>
              <Skeleton width={160} height={16} />
            </CardHeader>
            <div className="p-5">
              <Skeleton height={80} />
            </div>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton width={120} height={16} />
            </CardHeader>
            <div className="p-5">
              <Skeleton height={120} />
            </div>
          </Card>
        </div>
      </Layout>
    );
  }

  if (query.isError || !query.data) {
    return (
      <Layout title="Appointment">
        <div className="rounded-md border border-danger/20 bg-danger-subtle px-3.5 py-2.5 text-[13px] text-danger">
          Couldn&apos;t load this appointment — {query.error?.message ?? "unknown"}.{" "}
          <Link
            to="/appointments"
            className="ml-2 font-medium text-brand-700 hover:underline"
          >
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
        <Link to="/appointments" className="text-[12.5px] text-ink-muted hover:text-ink">
          ← All appointments
        </Link>
      }
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>Visit</CardHeader>
            <div className="p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-[20px] font-semibold tracking-tight text-ink">
                    {fullDate.format(start)}
                  </div>
                  <div className="mt-1 text-[12.5px] text-ink-muted tabular-nums">
                    {timeFmt.format(start)} – {timeFmt.format(end)}
                    <span className="text-ink-subtle"> · </span>
                    {formatRelative(start)}
                  </div>
                </div>
                <StatusPill status={a.status} />
              </div>

              <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-3 text-[13px] sm:grid-cols-[120px_1fr]">
                <Dt>Patient</Dt>
                <Dd>
                  <span className="font-medium text-ink">
                    {displayName(a.patientId, patientLookup.get(a.patientId), "patient")}
                  </span>
                  <span className="ml-1.5 text-[11.5px] text-ink-subtle">
                    #{a.patientId.slice(0, 8)}
                  </span>
                  <Link
                    to={`/patients/${a.patientId}`}
                    className="ml-3 text-[12px] font-medium text-brand-700 hover:text-brand-800 hover:underline"
                  >
                    View patient record
                  </Link>
                </Dd>
                <Dt>Reason</Dt>
                <Dd>
                  {a.reason ?? <span className="text-ink-subtle">— not provided</span>}
                </Dd>
                <Dt>Booked</Dt>
                <Dd>
                  {fullDate.format(created)}
                  <span className="ml-1.5 text-ink-subtle">· {formatRelative(created)}</span>
                </Dd>
                <Dt>Last updated</Dt>
                <Dd>{formatRelative(updated)}</Dd>
              </dl>
            </div>
          </Card>

          <Card>
            <CardHeader>Clinical notes</CardHeader>
            <div className="p-5">
              {a.notes ? (
                <pre className="m-0 whitespace-pre-wrap font-mono text-[13px] text-ink">
                  {a.notes}
                </pre>
              ) : (
                <p className="m-0 text-[13px] text-ink-muted">
                  No notes yet. Start a consultation to capture clinical observations,
                  diagnoses, and follow-up actions.
                </p>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>Actions</CardHeader>
            <div className="space-y-2 p-5">
              {canStartConsult ? (
                <button
                  onClick={() => navigate(`/consultation/${a.id}`)}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-brand-700 px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-brand-800"
                >
                  <PlayIcon size={12} />
                  Start consultation
                </button>
              ) : null}
              {canStartConsult ? (
                <a
                  href={`https://meet.jit.si/telehealth-${a.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-full items-center justify-center rounded-md border border-border bg-white px-3.5 py-2 text-[13px] font-medium text-ink transition hover:bg-[#F6F8FA]"
                >
                  Join video room
                </a>
              ) : null}
              {canConfirm ? (
                <button
                  onClick={() => transition.mutate("confirmed")}
                  disabled={transition.isPending}
                  className="w-full rounded-md bg-brand-700 px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-brand-800 disabled:opacity-60"
                >
                  ✓ Accept booking
                </button>
              ) : null}
              {canComplete && !canStartConsult ? (
                <button
                  onClick={() => transition.mutate("completed")}
                  disabled={transition.isPending}
                  className="w-full rounded-md border border-border bg-white px-3.5 py-2 text-[13px] font-medium text-ink transition hover:bg-[#F6F8FA] disabled:opacity-60"
                >
                  Mark complete
                </button>
              ) : null}
              {canCancel ? (
                <button
                  onClick={() => setConfirmCancel(true)}
                  disabled={transition.isPending}
                  className="w-full rounded-md border border-rose-200 bg-white px-3.5 py-2 text-[13px] font-medium text-rose-700 transition hover:bg-rose-50 disabled:opacity-60"
                >
                  {a.status === "scheduled" ? "Reject booking" : "Cancel"}
                </button>
              ) : null}
              {!canConfirm && !canComplete && !canCancel ? (
                <p className="m-0 text-[12.5px] text-ink-muted">
                  This appointment is{" "}
                  {a.status === "completed" ? "complete" : "cancelled"}.
                </p>
              ) : null}
            </div>
          </Card>

          <Card>
            <CardHeader>Timeline</CardHeader>
            <ul className="space-y-3 p-5">
              <TimelineItem
                when={created.toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
                what="Booking received"
              />
              {a.status !== "scheduled" ? (
                <TimelineItem
                  muted={a.status === "cancelled"}
                  when={updated.toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                  what={
                    a.status === "confirmed"
                      ? "Confirmed by you"
                      : a.status === "completed"
                        ? "Consultation completed"
                        : "Cancelled"
                  }
                />
              ) : null}
              <TimelineItem
                muted
                when={start.toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
                what="Scheduled visit time"
              />
            </ul>
          </Card>
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

function Card({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white shadow-[0_1px_2px_0_rgba(15,23,42,0.04)]">
      {children}
    </div>
  );
}

function CardHeader({ children }: { children: ReactNode }) {
  return (
    <div className="border-b border-border px-5 py-3.5 text-[13px] font-semibold tracking-tight text-ink">
      {children}
    </div>
  );
}

function Dt({ children }: { children: ReactNode }) {
  return (
    <dt className="text-[11.5px] font-medium uppercase tracking-wider text-ink-subtle">
      {children}
    </dt>
  );
}

function Dd({ children }: { children: ReactNode }) {
  return <dd className="text-ink">{children}</dd>;
}

function TimelineItem({
  when,
  what,
  muted = false,
}: {
  when: string;
  what: string;
  muted?: boolean;
}) {
  return (
    <li className={"flex items-start gap-3 " + (muted ? "opacity-60" : "")}>
      <span className="mt-1.5 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand-500" />
      <div>
        <div className="text-[12px] font-medium text-ink-muted tabular-nums">{when}</div>
        <div className="text-[13px] text-ink">{what}</div>
      </div>
    </li>
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
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-xl border border-border bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-2">
          <h2 className="text-[16px] font-semibold tracking-tight text-ink">
            {status === "scheduled" ? "Reject this booking?" : "Cancel this appointment?"}
          </h2>
          <p className="mt-2 text-[13.5px] text-ink-muted">
            The patient will be notified.
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border bg-[#FBFCFD] px-6 py-3">
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-md border border-border bg-white px-3.5 py-2 text-[13px] font-medium text-ink transition hover:bg-[#F6F8FA] disabled:opacity-60"
          >
            Go back
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="rounded-md bg-rose-600 px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
          >
            {status === "scheduled" ? "Yes, reject" : "Yes, cancel"}
          </button>
        </div>
      </div>
    </div>
  );
}
