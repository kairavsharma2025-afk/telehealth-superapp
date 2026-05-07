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

  // Resolve every patient's name in one batch.
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
    <Layout
      title="Patients"
      meta={<span>{patients.length} unique</span>}
    >
      <div className="card">
        <div className="toolbar">
          <div className="search">
            <span className="icon" aria-hidden="true">🔍</span>
            <input
              type="search"
              placeholder="Search by patient ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {query.isPending ? (
          <div className="card-pad muted">Loading patients…</div>
        ) : query.isError ? (
          <div className="card-pad">
            <div className="alert alert-error">{query.error.message}</div>
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"
                strokeLinejoin="round">
                <path d="M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0Z M3 21a9 9 0 0 1 18 0" />
              </svg>
            }
            title={search ? "No matches" : "No patients yet"}
            description={
              search
                ? "Try a different ID prefix."
                : "Once patients book with you, they'll show up here."
            }
          />
        ) : (
          <div>
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
                <Link
                  key={p.patientId}
                  to={`/patients/${p.patientId}`}
                  className="patient-row"
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <div className="avatar" aria-hidden="true">
                    {initials || "??"}
                  </div>
                  <div>
                    <div className="name">{name}</div>
                    <div className="stats">
                      {p.visits} visit{p.visits === 1 ? "" : "s"} ·{" "}
                      {p.completed} completed
                      {p.upcoming > 0 ? ` · ${p.upcoming} upcoming` : ""}
                    </div>
                  </div>
                  <div className="muted" style={{ fontSize: 13, textAlign: "right" }}>
                    {p.nextVisitAt ? (
                      <>
                        Next:{" "}
                        <strong style={{ color: "var(--color-brand-700)" }}>
                          {formatRelative(new Date(p.nextVisitAt))}
                        </strong>
                      </>
                    ) : p.lastVisitAt ? (
                      <>Last: {formatRelative(new Date(p.lastVisitAt))}</>
                    ) : (
                      "—"
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
