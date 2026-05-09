import { useEffect, useRef, useState, type ReactNode } from "react";
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

  const [notes, setNotes] = useState<string>("");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const lastSavedRef = useRef<string>("");
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (query.data) {
      setNotes(query.data.notes ?? "");
      lastSavedRef.current = query.data.notes ?? "";
      setSaveState("saved");
    }
  }, [query.data]);

  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, []);

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

  useEscapeKey(() => {
    if (id) navigate(`/appointments/${id}`);
  });

  if (!id) return null;

  if (query.isPending || !query.data) {
    return (
      <div className="min-h-screen bg-[#F6F8FA]">
        <header className="border-b border-border bg-white">
          <div className="mx-auto flex max-w-7xl items-center gap-2.5 px-6 py-4">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-700 text-white">
              <Logo size={18} color="#fff" />
            </span>
            <strong className="text-[15px] font-semibold tracking-tight text-ink">
              {brand.name}
            </strong>
            <span className="text-[12.5px] text-ink-muted">· Loading consultation…</span>
          </div>
        </header>
      </div>
    );
  }

  const a = query.data;
  const start = new Date(a.startAt);
  const end = new Date(a.endAt);
  const isTerminal = a.status === "completed" || a.status === "cancelled";

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
    <div className="min-h-screen bg-[#F6F8FA]">
      <header className="sticky top-0 z-20 border-b border-border bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-700 text-white">
              <Logo size={18} color="#fff" />
            </span>
            <strong className="text-[15px] font-semibold tracking-tight text-ink">
              {brand.name}
            </strong>
            <span className="text-[12.5px] text-ink-muted">· Consultation in progress</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div
              className="inline-flex items-center gap-2 rounded-md border border-border bg-white px-2.5 py-1.5 text-[13px] font-semibold text-ink tabular-nums"
              aria-live="polite"
            >
              <span className="relative inline-flex">
                <span className="h-2 w-2 rounded-full bg-rose-500" />
                <span className="absolute inset-0 animate-ping rounded-full bg-rose-400 opacity-60" />
              </span>
              {formatElapsed(elapsed)}
            </div>
            <a
              href={`https://meet.jit.si/telehealth-${a.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-border bg-white px-3 py-1.5 text-[13px] font-medium text-ink transition hover:bg-[#F6F8FA]"
            >
              Join video
            </a>
            <button
              onClick={() => completeMut.mutate()}
              disabled={completeMut.isPending || isTerminal}
              className="rounded-md bg-brand-700 px-3 py-1.5 text-[13px] font-semibold text-white transition hover:bg-brand-800 disabled:opacity-60"
            >
              {completeMut.isPending ? "Completing…" : "End consultation"}
            </button>
            <Link
              to={`/appointments/${a.id}`}
              className="rounded-md px-2.5 py-1.5 text-[13px] font-medium text-ink-muted transition hover:bg-[#F6F8FA] hover:text-ink"
            >
              ← Back
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 p-6 lg:grid-cols-[300px_1fr]">
        <aside>
          <Card>
            <CardHeader>Patient</CardHeader>
            <div className="p-5">
              <div className="grid h-14 w-14 place-items-center rounded-full bg-brand-100 text-[16px] font-semibold text-brand-800">
                {initials}
              </div>
              <div className="mt-3 text-[16px] font-semibold tracking-tight text-ink">
                {name}
              </div>
              <code className="mt-1 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[11.5px] text-ink-muted">
                #{a.patientId.slice(0, 8)}
              </code>
              <dl className="mt-4 grid grid-cols-1 gap-x-4 gap-y-3 text-[13px]">
                <Dt>Status</Dt>
                <Dd>
                  <StatusPill status={a.status} />
                </Dd>
                <Dt>Slot</Dt>
                <Dd>
                  <div>{fullDate.format(start)}</div>
                  <div className="tabular-nums text-ink-muted">
                    {timeFmt.format(start)}–{timeFmt.format(end)}
                  </div>
                </Dd>
                <Dt>Reason</Dt>
                <Dd>
                  {a.reason ?? <span className="text-ink-subtle">— not given</span>}
                </Dd>
              </dl>
            </div>
          </Card>
        </aside>

        <section>
          <Card>
            <CardHeader>Clinical notes</CardHeader>
            <div className="p-5">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={
                  "Subjective\n  • Patient reports …\n\nObjective\n  • Vitals …\n\nAssessment\n  • …\n\nPlan\n  • …"
                }
                disabled={isTerminal}
                aria-label="Clinical notes"
                className="block min-h-[400px] w-full resize-y rounded-md border border-border bg-white p-3 font-mono text-[13px] leading-relaxed text-ink placeholder:text-ink-subtle outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-500/15 disabled:bg-slate-50"
              />
              <div className="mt-3">
                <SaveIndicator state={saveState} />
              </div>
            </div>
          </Card>
        </section>
      </div>
    </div>
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

function SaveIndicator({ state }: { state: SaveState }) {
  const label =
    state === "saved"
      ? "All changes saved"
      : state === "saving"
        ? "Saving…"
        : state === "dirty"
          ? "Unsaved changes — autosaving"
          : "Couldn't save — your typing is held locally";
  const tone =
    state === "saved"
      ? "text-emerald-600"
      : state === "saving"
        ? "text-blue-600"
        : state === "dirty"
          ? "text-amber-600"
          : "text-danger";
  return (
    <span className={"inline-flex items-center gap-2 text-[12px] font-medium " + tone}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" /> {label}
    </span>
  );
}
