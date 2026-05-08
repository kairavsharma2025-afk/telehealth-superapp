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
  // Dashboard KPI tiles deep-link via either ?filter= or ?tab= (the
  // older naming). Both map onto the same internal filter set.
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

  // Re-sync filter if the URL changes (e.g. user clicks a Dashboard
  // KPI tile while on the page). The setState is no-op when the filter
  // already matches.
  useEffect(() => {
    setFilter(readFilterFromQuery(searchParams));
    setPage(1);
  }, [searchParams]);

  const updateFilter = (next: Filter) => {
    setFilter(next);
    setPage(1);
    // Mirror selection back into the URL so the chosen tab is
    // shareable / refresh-stable. Drop the param entirely for the
    // default ("today") to keep the URL clean.
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

  // Resolve every visible patient's name once, drives the row "who"
  // line + makes the search box match against names too.
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

  return (
    <Layout title="Appointments" meta={<span>{filtered.length} matching</span>}>
      <div className="card">
        <div className="toolbar">
          <div className="search">
            <span className="icon" aria-hidden="true">🔍</span>
            <input
              type="search"
              placeholder="Search by patient name, reason, or notes…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="filter-pills" role="tablist">
            {VISIBLE_FILTERS.map((f) => (
              <button
                key={f}
                className={f === filter ? "active" : ""}
                onClick={() => updateFilter(f)}
                role="tab"
                aria-selected={f === filter}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
            {/* "Awaiting" isn't in the regular pill row to keep the
                row compact, but the URL accepts ?filter=awaiting from
                the Dashboard KPI tile and we surface it here when
                active. */}
            {filter === "awaiting" ? (
              <button className="active" role="tab" aria-selected>
                Awaiting
              </button>
            ) : null}
          </div>
        </div>

        {query.isPending ? (
          <ul className="appt-list">
            <AppointmentRowSkeleton />
            <AppointmentRowSkeleton />
            <AppointmentRowSkeleton />
            <AppointmentRowSkeleton />
          </ul>
        ) : query.isError ? (
          <div className="card-pad">
            <div className="alert alert-error">
              Couldn&apos;t load appointments — {query.error.message}.{" "}
              <button
                className="link"
                onClick={() => void query.refetch()}
                style={{ marginLeft: 8 }}
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
          <ul className="appt-list">
            {visible.map((a) => (
              <li key={a.id}>
                <Link to={`/appointments/${a.id}`} className="appt-row">
                  <div className="appt-time" aria-hidden="true">
                    <span className="day">
                      {new Date(a.startAt)
                        .toLocaleDateString(undefined, { weekday: "short" })
                        .toUpperCase()}
                    </span>
                    <span className="time">
                      {new Date(a.startAt).toLocaleTimeString(undefined, {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                    <span className="date">
                      {new Date(a.startAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  <div className="appt-main">
                    <div className="who">
                      {displayName(a.patientId, patientLookup.get(a.patientId), "patient")}
                    </div>
                    <div className="reason">
                      {a.reason ?? "No reason provided"}{" "}
                      <span className="muted">· {dateFmt.format(new Date(a.startAt))}</span>
                    </div>
                  </div>
                  <div className="appt-side">
                    <StatusPill status={a.status} />
                    {a.notes ? (
                      <span className="muted" style={{ fontSize: 11 }}>
                        Notes attached
                      </span>
                    ) : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {totalPages > 1 ? (
          <div className="pagination">
            <span className="page-info">
              Showing {start + 1}–{Math.min(start + PAGE_SIZE, filtered.length)} of{" "}
              {filtered.length}
            </span>
            <div className="page-buttons">
              <button
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ‹ Prev
              </button>
              <span style={{ alignSelf: "center", fontSize: 13 }}>
                Page {safePage} of {totalPages}
              </span>
              <button
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
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

function EmptyIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 11h18" />
    </svg>
  );
}
