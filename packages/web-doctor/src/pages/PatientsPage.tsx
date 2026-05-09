import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, type ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Layout } from "../components/Layout";
import { EmptyState } from "../components/EmptyState";
import { formatRelative } from "../lib/countdown";
import { titleCase } from "../lib/queries";
import { useLookup } from "../lib/useLookup";

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

interface PatientSummary {
  patientId: string;
  visits: number;
  completed: number;
  upcoming: number;
  lastVisitAt: string | null;
  nextVisitAt: string | null;
}

function summarise(appts: Appointment[]): PatientSummary[] {
  const map = new Map<string, PatientSummary>();
  const now = Date.now();
  for (const a of appts) {
    const existing = map.get(a.patientId) ?? {
      patientId: a.patientId,
      visits: 0,
      completed: 0,
      upcoming: 0,
      lastVisitAt: null,
      nextVisitAt: null,
    };
    existing.visits++;
    const t = new Date(a.startAt).getTime();
    if (a.status === "completed") {
      existing.completed++;
      if (!existing.lastVisitAt || t > new Date(existing.lastVisitAt).getTime()) {
        existing.lastVisitAt = a.startAt;
      }
    }
    if (a.status !== "cancelled" && a.status !== "completed" && t >= now) {
      existing.upcoming++;
      if (!existing.nextVisitAt || t < new Date(existing.nextVisitAt).getTime()) {
        existing.nextVisitAt = a.startAt;
      }
    }
    map.set(a.patientId, existing);
  }
  return Array.from(map.values()).sort((a, b) => b.visits - a.visits);
}

export function PatientsPage() {
  const { user } = useAuth();
  const query = useQuery<ListResult, ApiError>({
    queryKey: ["appointments"],
    queryFn: () => api<ListResult>("/appointments"),
  });
  const [search, setSearch] = useState("");

  const patients = useMemo(() => {
    const mine = (query.data?.items ?? []).filter(
      (a) => a.doctorId === user?.id,
    );
    return summarise(mine);
  }, [query.data, user?.id]);

  const lookup = useLookup(patients.map((p) => p.patientId));

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter((p) => {
      const name = lookup.get(p.patientId)?.fullName ?? "";
      return (
        p.patientId.toLowerCase().includes(q) || name.toLowerCase().includes(q)
      );
    });
  }, [patients, search, lookup]);

  return (
    <Layout title="Patients" meta={<span>{patients.length} unique</span>}>
      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-[0_1px_2px_0_rgba(15,23,42,0.04)]">
        <div className="border-b border-border px-5 py-4">
          <div className="relative max-w-md">
            <span
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle"
              aria-hidden="true"
            >
              <SearchIcon />
            </span>
            <input
              type="search"
              placeholder="Search by name or patient ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-border bg-white py-2 pl-9 pr-3 text-[13px] text-ink placeholder:text-ink-subtle outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-500/15"
            />
          </div>
        </div>

        {query.isPending ? (
          <div className="px-5 py-12 text-center text-[13px] text-ink-muted">
            Loading patients…
          </div>
        ) : query.isError ? (
          <div className="px-5 py-4">
            <div className="rounded-md border border-danger/20 bg-danger-subtle px-3 py-2 text-[13px] text-danger">
              {query.error.message}
            </div>
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"
                strokeLinejoin="round">
                <path d="M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0Z M3 21a9 9 0 0 1 18 0" />
              </svg>
            }
            title={search ? "No matches" : "No patients yet"}
            description={
              search
                ? "Try a different name or ID prefix."
                : "Once patients book with you, they'll show up here."
            }
          />
        ) : (
          <ul>
            {visible.map((p) => {
              const info = lookup.get(p.patientId);
              const name = info?.fullName
                ? titleCase(info.fullName)
                : `Patient #${p.patientId.slice(0, 8)}`;
              const initials = (info?.fullName ?? "??")
                .split(/\s+/)
                .slice(0, 2)
                .map((w) => w.charAt(0).toUpperCase())
                .join("");
              return (
                <li key={p.patientId}>
                  <Link
                    to={`/patients/${p.patientId}`}
                    className="flex items-center gap-4 border-b border-border px-4 py-3 last:border-b-0 transition hover:bg-[#FBFCFD]"
                  >
                    <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-brand-100 text-[12.5px] font-semibold text-brand-800">
                      {initials || "??"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-medium text-ink">
                        {name}
                      </div>
                      <div className="mt-0.5 truncate text-[12px] text-ink-muted">
                        {p.visits} visit{p.visits === 1 ? "" : "s"}
                        <span className="text-ink-subtle"> · </span>
                        {p.completed} completed
                        {p.upcoming > 0 ? (
                          <>
                            <span className="text-ink-subtle"> · </span>
                            {p.upcoming} upcoming
                          </>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-right text-[12px] text-ink-muted">
                      {p.nextVisitAt ? (
                        <>
                          <span className="text-ink-subtle">Next: </span>
                          <span className="font-medium text-brand-700">
                            {formatRelative(new Date(p.nextVisitAt))}
                          </span>
                        </>
                      ) : p.lastVisitAt ? (
                        <>
                          <span className="text-ink-subtle">Last: </span>
                          {formatRelative(new Date(p.lastVisitAt))}
                        </>
                      ) : (
                        <span className="text-ink-subtle">—</span>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
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
