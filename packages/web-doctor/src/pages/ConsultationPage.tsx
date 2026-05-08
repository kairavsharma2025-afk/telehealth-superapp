import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { brand } from "@telehealth/design";
import { api, type ApiError } from "../lib/api";
import { StatusPill, type AppointmentStatus } from "../components/StatusPill";
import { Logo } from "../components/Logo";
import { useEscapeKey, useToast } from "../lib/toast";
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
}

const fullDate = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "short",
  day: "numeric",
});
const timeFmt = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});

const AUTOSAVE_DEBOUNCE_MS = 1200;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0 ? `${h}:${pad2(m)}:${pad2(s)}` : `${pad2(m)}:${pad2(s)}`;
}

type SaveState = "saved" | "saving" | "dirty" | "error";

export function ConsultationPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();

  const query = useQuery<Appointment, ApiError>({
    queryKey: ["appointments", id],
    queryFn: () => api<Appointment>(`/appointments/${id ?? ""}`),
    enabled: !!id,
    refetchOnWindowFocus: false,
  });
  const patientLookup = useLookup(query.data ? [query.data.patientId] : []);

  // Local edit buffer for the notes textarea + autosave plumbing.
  const [notes, setNotes] = useState<string>("");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const lastSavedRef = useRef<string>("");
  const debounceRef = useRef<number | null>(null);

  // Seed the buffer once when the appointment loads.
  useEffect(() => {
    if (query.data) {
      setNotes(query.data.notes ?? "");
      lastSavedRef.current = query.data.notes ?? "";
      setSaveState("saved");
    }
  }, [query.data]);

  // Stopwatch — runs while the consultation is open. Saved as elapsed
  // seconds in component state; not persisted (Phase 7 video session
  // would emit duration metrics from the SFU directly).
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, []);

  // Autosave: when notes diverge from the last persisted value, queue a
  // PATCH after a debounce window.
  const saveMut = useMutation<Appointment, ApiError, string>({
    mutationFn: (next) =>
      api<Appointment>(`/appointments/${id ?? ""}`, {
        method: "PATCH",
        body: { notes: next },
      }),
    onSuccess: (data, vars) => {
      lastSavedRef.current = vars;
      qc.setQueryData(["appointments", id], data);
      setSaveState((curr) => (curr === "dirty" ? "dirty" : "saved"));
    },
    onError: (err) => {
      setSaveState("error");
      toast.push({
        tone: "error",
        title: "Notes not saved",
        description: err.message,
      });
    },
  });

  useEffect(() => {
    if (notes === lastSavedRef.current) {
      setSaveState("saved");
      return;
    }
    setSaveState("dirty");
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
    }
    debounceRef.current = window.setTimeout(() => {
      setSaveState("saving");
      saveMut.mutate(notes);
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, [notes, saveMut]);

  const completeMut = useMutation<Appointment, ApiError>({
    mutationFn: () =>
      api<Appointment>(`/appointments/${id ?? ""}`, {
        method: "PATCH",
        body: {
          status: "completed",
          // Flush any unsaved notes alongside the status change so we
          // don't leave the visit completed-but-empty if the user hits
          // End right after typing.
          ...(notes !== lastSavedRef.current ? { notes } : {}),
        },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["appointments"] });
      toast.push({ tone: "success", title: "Consultation marked complete." });
      navigate(`/appointments/${id ?? ""}`);
    },
    onError: (err) => {
      toast.push({
        tone: "error",
        title: "Couldn't complete",
        description: err.message,
      });
    },
  });

  // Esc out of consult mode (back to detail page).
  useEscapeKey(() => {
    if (id) navigate(`/appointments/${id}`);
  });

  if (!id) return null;

  if (query.isPending || !query.data) {
    return (
      <div className="consult-shell">
        <header className="consult-topbar">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Logo size={24} color="var(--color-brand-700)" />
            <strong>{brand.name}</strong>
            <span className="muted">· Loading consultation…</span>
          </div>
        </header>
      </div>
    );
  }

  const a = query.data;
  const start = new Date(a.startAt);
  const end = new Date(a.endAt);
  const isTerminal = a.status === "completed" || a.status === "cancelled";

  return (
    <div className="consult-shell">
      <header className="consult-topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Logo size={24} color="var(--color-brand-700)" />
          <strong>{brand.name}</strong>
          <span className="muted">· Consultation in progress</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="consult-timer" aria-live="polite">
            <span className="pulse" aria-hidden="true" />
            {formatElapsed(elapsed)}
          </div>
          <a
            href={`https://meet.jit.si/telehealth-${a.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn"
            style={{ textDecoration: "none" }}
          >
            Join video
          </a>
          <button
            onClick={() => completeMut.mutate()}
            disabled={completeMut.isPending || isTerminal}
          >
            {completeMut.isPending ? "Completing…" : "End consultation"}
          </button>
          <Link
            to={`/appointments/${a.id}`}
            className="btn-ghost"
            style={{ padding: "6px 12px" }}
          >
            ← Back
          </Link>
        </div>
      </header>

      <div className="consult-body">
        <aside>
          <div className="detail-section">
            <h3>Patient</h3>
            <div className="body">
              {(() => {
                const info = patientLookup.get(a.patientId);
                const initials = info?.fullName
                  ? info.fullName
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((w) => w.charAt(0).toUpperCase())
                      .join("")
                  : "??";
                const name = displayName(a.patientId, info, "patient");
                return (
                  <>
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 28,
                        background: "var(--color-brand-subtle)",
                        color: "var(--color-brand-800)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 600,
                        fontSize: 18,
                        marginBottom: 12,
                      }}
                    >
                      {initials}
                    </div>
                    <div
                      style={{
                        fontSize: 17,
                        fontWeight: 600,
                        marginBottom: 4,
                      }}
                    >
                      {name}
                    </div>
                    <div className="muted" style={{ fontSize: 12, marginBottom: 12 }}>
                      #{a.patientId.slice(0, 8)}
                    </div>
                  </>
                );
              })()}
              <dl className="prop-list">
                <dt>Status</dt>
                <dd>
                  <StatusPill status={a.status} />
                </dd>
                <dt>Slot</dt>
                <dd>
                  {fullDate.format(start)}
                  <br />
                  {timeFmt.format(start)}–{timeFmt.format(end)}
                </dd>
                <dt>Reason</dt>
                <dd>{a.reason ?? <span className="muted">— not given</span>}</dd>
              </dl>
            </div>
          </div>
        </aside>

        <section>
          <div className="detail-section">
            <h3>Clinical notes</h3>
            <div className="body consult-notes-editor">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={
                  "Subjective\n  • Patient reports …\n\nObjective\n  • Vitals …\n\nAssessment\n  • …\n\nPlan\n  • …"
                }
                disabled={isTerminal}
                aria-label="Clinical notes"
              />
              <SaveIndicator state={saveState} />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  const label =
    state === "saved"
      ? "All changes saved"
      : state === "saving"
        ? "Saving…"
        : state === "dirty"
          ? "Unsaved changes — autosaving"
          : "Couldn't save — your typing is held locally";
  return (
    <span className={`consult-save-state ${state}`}>
      <span className="dot" /> {label}
    </span>
  );
}
