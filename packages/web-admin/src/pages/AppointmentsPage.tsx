import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ApiError } from "../lib/api";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { EmptyState } from "../components/EmptyState";
import { useToast } from "../components/Toast";

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

interface LookupItem {
  id: string;
  fullName: string | null;
  role: "patient" | "doctor" | "admin";
}
interface LookupResult {
  items: LookupItem[];
}

type RangeKey =
  | "today"
  | "week-window"
  | "month-window"
  | "upcoming-week"
  | "upcoming-month"
  | "past-week"
  | "past-month"
  | "all";

function rangeWindow(key: RangeKey): { from?: string; to?: string } {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  switch (key) {
    case "today": {
      const end = new Date(startOfToday);
      end.setDate(end.getDate() + 1);
      return { from: startOfToday.toISOString(), to: end.toISOString() };
    }
    case "week-window": {
      const start = new Date(startOfToday);
      start.setDate(start.getDate() - 7);
      const end = new Date(startOfToday);
      end.setDate(end.getDate() + 7);
      return { from: start.toISOString(), to: end.toISOString() };
    }
    case "month-window": {
      const start = new Date(startOfToday);
      start.setDate(start.getDate() - 30);
      const end = new Date(startOfToday);
      end.setDate(end.getDate() + 30);
      return { from: start.toISOString(), to: end.toISOString() };
    }
    case "upcoming-week": {
      const end = new Date(startOfToday);
      end.setDate(end.getDate() + 7);
      return { from: startOfToday.toISOString(), to: end.toISOString() };
    }
    case "upcoming-month": {
      const end = new Date(startOfToday);
      end.setDate(end.getDate() + 30);
      return { from: startOfToday.toISOString(), to: end.toISOString() };
    }
    case "past-week": {
      const start = new Date(startOfToday);
      start.setDate(start.getDate() - 7);
      return { from: start.toISOString(), to: startOfToday.toISOString() };
    }
    case "past-month": {
      const start = new Date(startOfToday);
      start.setDate(start.getDate() - 30);
      return { from: start.toISOString(), to: startOfToday.toISOString() };
    }
    case "all":
      return {};
  }
}

function listAll(window: { from?: string; to?: string }): Promise<ListResult> {
  const qs = new URLSearchParams();
  if (window.from) qs.set("from", window.from);
  if (window.to) qs.set("to", window.to);
  const path = qs.toString() ? `/appointments?${qs.toString()}` : "/appointments";
  return api<ListResult>(path);
}

function titleCase(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

interface DisplayInfo {
  text: string;
  unknown: boolean;
}

function displayInfo(
  info: LookupItem | undefined,
  fallback: "patient" | "doctor",
): DisplayInfo {
  const role = info?.role ?? fallback;
  const name = info?.fullName?.trim();
  if (name) {
    return {
      text: role === "doctor" ? `Dr. ${titleCase(name)}` : titleCase(name),
      unknown: false,
    };
  }
  return {
    text: role === "doctor" ? "Unknown Doctor" : "Unknown Patient",
    unknown: true,
  };
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

type StatusFilter =
  | "all"
  | "scheduled"
  | "confirmed"
  | "completed"
  | "cancelled";

const STATUS_PILL: Record<Appointment["status"], string> = {
  scheduled: "bg-amber-50 text-amber-700 ring-amber-200",
  confirmed: "bg-blue-50 text-blue-700 ring-blue-200",
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  cancelled: "bg-rose-50 text-rose-700 ring-rose-200",
};

const STATUS_LABEL: Record<Appointment["status"], string> = {
  scheduled: "Scheduled",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function AppointmentsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const [range, setRange] = useState<RangeKey>("week-window");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => {
    const initial = searchParams.get("status");
    if (
      initial === "scheduled" ||
      initial === "confirmed" ||
      initial === "completed" ||
      initial === "cancelled"
    ) {
      return initial;
    }
    return "all";
  });
  const [showReason, setShowReason] = useState(false);
  const [pendingCancel, setPendingCancel] = useState<Appointment | null>(null);

  const dateRange = useMemo(() => rangeWindow(range), [range]);

  const query = useQuery<ListResult, ApiError>({
    queryKey: ["all-appointments", range],
    queryFn: () => listAll(dateRange),
  });

  const cancelMut = useMutation<Appointment, ApiError, Appointment>({
    mutationFn: (a) => cancel(a.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-appointments"] });
      toast.show("Appointment cancelled.", "success");
    },
    onError: (err) => {
      toast.show(err.message || "Cancel failed.", "error");
    },
  });

  useEffect(() => {
    const initial = searchParams.get("status");
    if (
      initial === "scheduled" ||
      initial === "confirmed" ||
      initial === "completed" ||
      initial === "cancelled" ||
      initial === "all"
    ) {
      setStatusFilter(initial);
    }
  }, [searchParams]);

  const allItems = query.data?.items ?? [];
  const items = useMemo(
    () =>
      statusFilter === "all"
        ? allItems
        : allItems.filter((a) => a.status === statusFilter),
    [allItems, statusFilter],
  );

  const idBatches = useMemo(() => {
    const ids = new Set<string>();
    for (const a of items) {
      ids.add(a.patientId);
      ids.add(a.doctorId);
    }
    const sorted = Array.from(ids).sort();
    const batches: string[][] = [];
    for (let i = 0; i < sorted.length; i += 200) {
      batches.push(sorted.slice(i, i + 200));
    }
    return batches;
  }, [items]);

  const lookupQueries = useQuery<LookupItem[], ApiError>({
    queryKey: ["users-lookup", idBatches.map((b) => b.join(",")).join("|")],
    queryFn: async () => {
      const results = await Promise.all(
        idBatches.map((batch) =>
          api<LookupResult>(`/users/lookup?ids=${batch.join(",")}`),
        ),
      );
      return results.flatMap((r) => r.items);
    },
    enabled: idBatches.length > 0,
    staleTime: 5 * 60_000,
  });

  const lookupMap = useMemo(() => {
    const m = new Map<string, LookupItem>();
    for (const item of lookupQueries.data ?? []) m.set(item.id, item);
    return m;
  }, [lookupQueries.data]);

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
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-ink">
            Appointments
          </h1>
          <p className="mt-1 text-[13px] text-ink-muted">
            Every appointment across the platform.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={range}
            onChange={(v) => setRange(v as RangeKey)}
            ariaLabel="Range"
            options={[
              { value: "today", label: "Today only" },
              { value: "week-window", label: "±7 days" },
              { value: "month-window", label: "±30 days" },
              { value: "upcoming-week", label: "Next 7 days" },
              { value: "upcoming-month", label: "Next 30 days" },
              { value: "past-week", label: "Past 7 days" },
              { value: "past-month", label: "Past 30 days" },
              { value: "all", label: "All time" },
            ]}
          />
          <Select
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as StatusFilter)}
            ariaLabel="Filter by status"
            options={[
              { value: "all", label: "All statuses" },
              { value: "scheduled", label: "Pending" },
              { value: "confirmed", label: "Confirmed" },
              { value: "completed", label: "Completed" },
              { value: "cancelled", label: "Cancelled" },
            ]}
          />
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Total appointments" value={kpis.total} primary />
        <Kpi label="Today" value={kpis.today} />
        <Kpi label="Currently confirmed" value={kpis.confirmed} />
        <Kpi label="Cancellation rate" value={`${kpis.cancelRate}%`} />
      </div>

      {query.isError ? (
        <Alert>Failed to load: {query.error.message}</Alert>
      ) : null}
      {cancelMut.isError ? (
        <Alert>Cancel failed: {cancelMut.error.message}</Alert>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-[0_1px_2px_0_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-[15px] font-semibold tracking-tight text-ink">
            All appointments
          </h2>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowReason((s) => !s)}
              aria-pressed={showReason}
              className="rounded-md border border-border bg-white px-2.5 py-1 text-[12px] font-medium text-ink-muted transition hover:bg-[#F6F8FA] hover:text-ink"
            >
              {showReason ? "Hide Reason" : "Show Reason"}
            </button>
            <span className="text-[12.5px] text-ink-muted">
              {items.length} {items.length === 1 ? "row" : "rows"}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-border bg-[#FBFCFD]">
                <Th>When</Th>
                <Th>Patient</Th>
                <Th>Doctor</Th>
                {showReason ? <Th>Reason</Th> : null}
                <Th>Status</Th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {query.isPending ? (
                <tr>
                  <td
                    colSpan={showReason ? 6 : 5}
                    className="px-5 py-12 text-center text-[13px] text-ink-muted"
                  >
                    Loading…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={showReason ? 6 : 5} className="p-0">
                    <EmptyState
                      title="No results found"
                      description={
                        statusFilter !== "all"
                          ? `No ${statusFilter} appointments in this window.`
                          : "Nothing in this window. Try a wider range."
                      }
                      action={
                        statusFilter !== "all" || range !== "week-window" ? (
                          <button
                            onClick={() => {
                              setStatusFilter("all");
                              setRange("week-window");
                            }}
                            className="rounded-md border border-border bg-white px-3 py-1.5 text-[12.5px] font-medium text-ink-muted transition hover:bg-[#F6F8FA] hover:text-ink"
                          >
                            Clear filters
                          </button>
                        ) : undefined
                      }
                    />
                  </td>
                </tr>
              ) : (
                items.map((a) => {
                  const patient = displayInfo(lookupMap.get(a.patientId), "patient");
                  const doctor = displayInfo(lookupMap.get(a.doctorId), "doctor");
                  return (
                    <tr
                      key={a.id}
                      className="border-b border-border last:border-b-0 transition hover:bg-[#FBFCFD]"
                    >
                      <td className="px-4 py-3 text-[12.5px] text-ink tabular-nums">
                        {fmtRange(a.startAt, a.endAt)}
                      </td>
                      <td
                        className={
                          "px-4 py-3 " +
                          (patient.unknown ? "text-ink-subtle italic" : "text-ink")
                        }
                      >
                        {patient.text}
                      </td>
                      <td
                        className={
                          "px-4 py-3 " +
                          (doctor.unknown ? "text-ink-subtle italic" : "text-ink")
                        }
                      >
                        {doctor.text}
                      </td>
                      {showReason ? (
                        <td className="px-4 py-3 text-[12.5px] text-ink-muted">
                          {a.reason ?? "—"}
                        </td>
                      ) : null}
                      <td className="px-4 py-3">
                        <span
                          className={
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 " +
                            STATUS_PILL[a.status]
                          }
                        >
                          <span
                            className="h-1.5 w-1.5 rounded-full bg-current"
                            aria-hidden="true"
                          />
                          {STATUS_LABEL[a.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {a.status === "scheduled" || a.status === "confirmed" ? (
                          <button
                            disabled={cancelMut.isPending}
                            onClick={() => setPendingCancel(a)}
                            className="rounded-md px-2.5 py-1 text-[12.5px] font-medium text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
                          >
                            Force cancel
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        open={pendingCancel !== null}
        title="Cancel this appointment?"
        description={
          pendingCancel ? (
            <>
              Force-cancel the appointment on{" "}
              <strong>
                {new Date(pendingCancel.startAt).toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </strong>
              ? The patient and doctor will both lose this slot.
            </>
          ) : null
        }
        confirmLabel="Force cancel"
        destructive
        busy={cancelMut.isPending}
        onCancel={() => setPendingCancel(null)}
        onConfirm={() => {
          if (!pendingCancel) return;
          cancelMut.mutate(pendingCancel, {
            onSettled: () => setPendingCancel(null),
          });
        }}
      />
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

function Th({ children }: { children: ReactNode }) {
  return (
    <th className="px-4 py-2.5 text-[11.5px] font-semibold uppercase tracking-wider text-ink-muted">
      {children}
    </th>
  );
}

function Alert({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border border-danger/20 bg-danger-subtle px-3.5 py-2.5 text-[13px] text-danger">
      {children}
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  ariaLabel: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel}
      className="rounded-md border border-border bg-white px-3 py-2 text-[13px] text-ink outline-none transition focus:border-slate-700 focus:ring-2 focus:ring-slate-500/15"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function Kpi({
  label,
  value,
  primary = false,
}: {
  label: string;
  value: number | string;
  primary?: boolean;
}) {
  return (
    <div
      className={
        "flex flex-col rounded-xl border bg-white p-4 " +
        (primary ? "border-slate-300" : "border-border")
      }
    >
      <span className="text-[11.5px] font-medium uppercase tracking-wider text-ink-muted">
        {label}
      </span>
      <span className="mt-2 text-[26px] font-semibold tracking-tight text-ink tabular-nums">
        {value}
      </span>
    </div>
  );
}
