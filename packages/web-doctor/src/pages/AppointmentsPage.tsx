import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
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

type Filter = "all" | "today" | "upcoming" | "completed" | "cancelled";

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
  const query = useQuery<ListResult, ApiError>({
    queryKey: ["appointments"],
    queryFn: listAppointments,
  });

  const [filter, setFilter] = useState<Filter>("today");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const mine = useMemo(
    () => (query.data?.items ?? []).filter((a) => a.doctorId === user?.id),
    [query.data, user?.id],
  );

  const filtered = useMemo(() => {
    const today = new Date();
    let bucket: Appointment[];
    switch (filter) {
      case "today":
        bucket = mine.filter((a) => isSameDay(new Date(a.startAt), today));
        break;
      case "upcoming":
        bucket = mine.filter(
          (a) =>
            new Date(a.startAt) > today &&
            !isSameDay(new Date(a.startAt), today) &&
            a.status !== "cancelled",
        );
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
        a.reason ?? "",
        a.notes ?? "",
        a.status,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [mine, filter, search]);

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
              placeholder="Search by patient ID, reason, or notes…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="filter-pills" role="tablist">
            {(["today", "upcoming", "completed", "cancelled", "all"] as const).map(
              (f) => (
                <button
                  key={f}
                  className={f === filter ? "active" : ""}
                  onClick={() => {
                    setFilter(f);
                    setPage(1);
                  }}
                  role="tab"
                  aria-selected={f === filter}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ),
            )}
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
                      Patient ·{" "}
                      <span className="muted">#{a.patientId.slice(0, 8)}</span>
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
