import { useEffect, useMemo, useState } from "react";
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
  /** True when we couldn't find the user's real name and fell back. */
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

  // Sync the URL ?status= deep link from the Overview cards to local
  // state. Re-runs when the user navigates back/forward.
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
    <div>
      <header className="page-header">
        <h1>Appointments</h1>
        <div className="filters">
          <label className="muted" htmlFor="range">Range</label>
          <select
            id="range"
            value={range}
            onChange={(e) => setRange(e.target.value as RangeKey)}
          >
            <option value="today">Today only</option>
            <option value="week-window">±7 days (past + today + upcoming)</option>
            <option value="month-window">±30 days (past + today + upcoming)</option>
            <option value="upcoming-week">Next 7 days</option>
            <option value="upcoming-month">Next 30 days</option>
            <option value="past-week">Past 7 days</option>
            <option value="past-month">Past 30 days</option>
            <option value="all">All time</option>
          </select>
          <label className="muted" htmlFor="status-filter">Status</label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            aria-label="Filter by status"
          >
            <option value="all">All statuses</option>
            <option value="scheduled">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <button
              className="secondary"
              onClick={() => setShowReason((s) => !s)}
              aria-pressed={showReason}
              style={{ padding: "5px 12px", fontSize: "var(--font-size-xs)" }}
            >
              {showReason ? "Hide Reason column" : "Show Reason column"}
            </button>
            <span className="muted">
              {items.length} {items.length === 1 ? "row" : "rows"}
            </span>
          </div>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Patient</th>
              <th>Doctor</th>
              {showReason ? <th>Reason</th> : null}
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {query.isPending ? (
              <tr>
                <td
                  colSpan={showReason ? 6 : 5}
                  className="muted"
                  style={{ padding: 24 }}
                >
                  Loading…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={showReason ? 6 : 5} style={{ padding: 0 }}>
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
                          className="secondary"
                          onClick={() => {
                            setStatusFilter("all");
                            setRange("week-window");
                          }}
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
                const patient = displayInfo(
                  lookupMap.get(a.patientId),
                  "patient",
                );
                const doctor = displayInfo(
                  lookupMap.get(a.doctorId),
                  "doctor",
                );
                return (
                  <tr key={a.id}>
                    <td>{fmtRange(a.startAt, a.endAt)}</td>
                    <td className={patient.unknown ? "muted" : ""}>
                      {patient.text}
                    </td>
                    <td className={doctor.unknown ? "muted" : ""}>
                      {doctor.text}
                    </td>
                    {showReason ? (
                      <td className="muted">{a.reason ?? "—"}</td>
                    ) : null}
                    <td>
                      <span className={`pill pill-${a.status}`}>{a.status}</span>
                    </td>
                    <td className="actions">
                      {a.status === "scheduled" || a.status === "confirmed" ? (
                        <button
                          className="danger"
                          disabled={cancelMut.isPending}
                          onClick={() => setPendingCancel(a)}
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
