import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, type ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Layout } from "../components/Layout";
import {
  StatusPill,
  type AppointmentStatus,
} from "../components/StatusPill";
import { EmptyState } from "../components/EmptyState";
import { AppointmentRowSkeleton } from "../components/Skeleton";
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

interface ListResult {
  items: Appointment[];
}

type Filter =
  | "all"
  | "today"
  | "upcoming"
  | "completed"
  | "cancelled"
  | "awaiting";

const VISIBLE_FILTERS: readonly Filter[] = [
  "upcoming",
  "today",
  "completed",
  "cancelled",
  "all",
];

function readFilterFromQuery(params: URLSearchParams): Filter {
  const v = params.get("filter") ?? params.get("tab");
  switch (v) {
    case "today":
    case "upcoming":
    case "completed":
    case "cancelled":
    case "awaiting":
    case "all":
      return v;
    default:
      return "upcoming";
  }
}

const PAGE_SIZE = 20;

const dateFmt = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function listAppointments(): Promise<ListResult> {
  return api<ListResult>("/appointments");
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function AppointmentsPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = useQuery<ListResult, ApiError>({
    queryKey: ["appointments"],
    queryFn: listAppointments,
  });

  const [filter, setFilter] = useState<Filter>(() =>
    readFilterFromQuery(searchParams),
  );
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setFilter(readFilterFromQuery(searchParams));
    setPage(1);
  }, [searchParams]);

  const updateFilter = (next: Filter) => {
    setFilter(next);
    setPage(1);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("tab");
    if (next === "today") {
      nextParams.delete("filter");
    } else {
      nextParams.set("filter", next);
    }
    setSearchParams(nextParams, { replace: true });
  };

  const mine = useMemo(
    () => (query.data?.items ?? []).filter((a) => a.doctorId === user?.id),
    [query.data, user?.id],
  );

  const patientLookup = useLookup(mine.map((a) => a.patientId));

  const filtered = useMemo(() => {
    const today = new Date();
    let bucket: Appointment[];
    switch (filter) {
      case "today":
        bucket = mine.filter((a) => isSameDay(new Date(a.startAt), today));
        break;
      case "upcoming": {
        const startOfToday = new Date(today);
        startOfToday.setHours(0, 0, 0, 0);
        bucket = mine.filter(
          (a) =>
            new Date(a.startAt) >= startOfToday && a.status !== "cancelled",
        );
        break;
      }
      case "awaiting":
        bucket = mine.filter((a) => a.status === "scheduled");
        break;
      case "completed":
        bucket = mine.filter((a) => a.status === "completed");
        break;
      case "cancelled":
        bucket = mine.filter((a) => a.status === "cancelled");
        break;
      case "all":
      default:
        bucket = mine;
    }
    const q = search.trim().toLowerCase();
    if (!q) return bucket;
    return bucket.filter((a) => {
      const haystack = [
        a.patientId,
        patientLookup.get(a.patientId)?.fullName ?? "",
        a.reason ?? "",
        a.notes ?? "",
        a.status,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [mine, filter, search, patientLookup]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE);

  const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: "short" });
  const monthDayFmt = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
  const timeFmt = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

  return (
    <Layout title="Appointments" meta={<span>{filtered.length} matching</span>}>
      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-[0_1px_2px_0_rgba(15,23,42,0.04)]">
        <div className="flex flex-col gap-3 border-b border-border px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1 lg:max-w-md">
            <span
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle"
              aria-hidden="true"
            >
              <SearchIcon />
            </span>
            <input
              type="search"
              placeholder="Search by patient name, reason, or notes…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-md border border-border bg-white py-2 pl-9 pr-3 text-[13px] text-ink placeholder:text-ink-subtle outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-500/15"
            />
          </div>
          <div
            className="inline-flex flex-shrink-0 rounded-md border border-border bg-[#F6F8FA] p-0.5"
            role="tablist"
          >
            {VISIBLE_FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => updateFilter(f)}
                role="tab"
                aria-selected={f === filter}
                className={
                  "rounded px-2.5 py-1 text-[12.5px] font-medium transition " +
                  (f === filter
                    ? "bg-white text-ink shadow-sm"
                    : "text-ink-muted hover:text-ink")
                }
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
            {filter === "awaiting" ? (
              <button
                role="tab"
                aria-selected
                className="rounded bg-white px-2.5 py-1 text-[12.5px] font-medium text-ink shadow-sm"
              >
                Awaiting
              </button>
            ) : null}
          </div>
        </div>

        {query.isPending ? (
          <ul>
            <AppointmentRowSkeleton />
            <AppointmentRowSkeleton />
            <AppointmentRowSkeleton />
            <AppointmentRowSkeleton />
          </ul>
        ) : query.isError ? (
          <div className="px-5 py-4">
            <div className="rounded-md border border-danger/20 bg-danger-subtle px-3 py-2 text-[13px] text-danger">
              Couldn&apos;t load appointments — {query.error.message}.{" "}
              <button
                className="ml-1 font-medium underline"
                onClick={() => void query.refetch()}
              >
                Retry
              </button>
            </div>
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<EmptyIcon />}
            title={search ? "No matches" : `Nothing in ${filter}`}
            description={
              search
                ? "Try a different search term, or clear the search."
                : filter === "today"
                  ? "Your day is clear — new bookings will appear here."
                  : "No appointments in this bucket."
            }
          />
        ) : (
          <ul>
            {visible.map((a) => (
              <li key={a.id}>
                <Link
                  to={`/appointments/${a.id}`}
                  className="flex items-center gap-4 border-b border-border px-4 py-3 last:border-b-0 transition hover:bg-[#FBFCFD]"
                >
                  <div
                    className="flex h-[58px] w-[72px] flex-shrink-0 flex-col items-center justify-center rounded-lg border border-border bg-[#FBFCFD] leading-tight"
                    aria-hidden="true"
                  >
                    <span className="text-[10.5px] font-semibold uppercase tracking-wider text-ink-subtle">
                      {dayFmt.format(new Date(a.startAt))}
                    </span>
                    <span className="mt-0.5 text-[14px] font-semibold text-ink tabular-nums">
                      {timeFmt.format(new Date(a.startAt))}
                    </span>
                    <span className="text-[10.5px] text-ink-muted">
                      {monthDayFmt.format(new Date(a.startAt))}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-medium text-ink">
                      {displayName(a.patientId, patientLookup.get(a.patientId), "patient")}
                    </div>
                    <div className="mt-0.5 truncate text-[12.5px] text-ink-muted">
                      {a.reason ?? "No reason provided"}
                      <span className="ml-1 text-ink-subtle">
                        · {dateFmt.format(new Date(a.startAt))}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
                    <StatusPill status={a.status} />
                    {a.notes ? (
                      <span className="text-[10.5px] text-ink-subtle">Notes attached</span>
                    ) : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {totalPages > 1 ? (
          <div className="flex flex-col gap-3 border-t border-border bg-[#FBFCFD] px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-[12px] text-ink-muted">
              Showing {start + 1}–{Math.min(start + PAGE_SIZE, filtered.length)} of{" "}
              {filtered.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-md border border-border bg-white px-2.5 py-1 text-[12.5px] font-medium text-ink transition hover:bg-[#F6F8FA] disabled:cursor-not-allowed disabled:opacity-50"
              >
                ‹ Prev
              </button>
              <span className="text-[12px] text-ink-muted tabular-nums">
                Page {safePage} of {totalPages}
              </span>
              <button
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-md border border-border bg-white px-2.5 py-1 text-[12.5px] font-medium text-ink transition hover:bg-[#F6F8FA] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next ›
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </Layout>
  );
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="7" cy="7" r="5" />
      <path d="m13 13-2.5-2.5" />
    </svg>
  );
}

function EmptyIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 11h18" />
    </svg>
  );
}
