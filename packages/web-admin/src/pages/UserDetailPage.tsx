import { useMemo, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, type ApiError } from "../lib/api";

interface User {
  id: string;
  email: string;
  role: "patient" | "doctor" | "admin";
  isActive: boolean;
  createdAt: string;
}
interface UsersResult {
  items: User[];
}

interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  startAt: string;
  endAt: string;
  status: "scheduled" | "confirmed" | "completed" | "cancelled";
  reason: string | null;
}
interface AppointmentsResult {
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

const ROLE_PILL: Record<User["role"], string> = {
  patient: "bg-blue-50 text-blue-700 ring-blue-200",
  doctor: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  admin: "bg-slate-100 text-slate-800 ring-slate-300",
};

const STATUS_PILL: Record<Appointment["status"], string> = {
  scheduled: "bg-amber-50 text-amber-700 ring-amber-200",
  confirmed: "bg-blue-50 text-blue-700 ring-blue-200",
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  cancelled: "bg-rose-50 text-rose-700 ring-rose-200",
};

function titleCase(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export function UserDetailPage() {
  const { id } = useParams<{ id: string }>();

  const usersQuery = useQuery<UsersResult, ApiError>({
    queryKey: ["users", "all", true],
    queryFn: () => api<UsersResult>("/admin/users?includeInactive=true"),
    staleTime: 60_000,
  });

  const user = usersQuery.data?.items.find((u) => u.id === id);

  const appointmentsQuery = useQuery<AppointmentsResult, ApiError>({
    queryKey: ["user-appointments", id],
    queryFn: () => api<AppointmentsResult>("/appointments"),
    enabled: !!user,
    staleTime: 30_000,
  });

  const userAppointments = useMemo(() => {
    if (!user) return [];
    const all = appointmentsQuery.data?.items ?? [];
    return all
      .filter((a) =>
        user.role === "doctor" ? a.doctorId === user.id : a.patientId === user.id,
      )
      .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime())
      .slice(0, 20);
  }, [user, appointmentsQuery.data]);

  const counterpartyIds = useMemo(() => {
    if (!user) return [] as string[];
    const ids = new Set<string>();
    for (const a of userAppointments) {
      ids.add(user.role === "doctor" ? a.patientId : a.doctorId);
    }
    return Array.from(ids).sort();
  }, [user, userAppointments]);

  const lookupQuery = useQuery<LookupResult, ApiError>({
    queryKey: ["users-lookup", counterpartyIds.join(",")],
    queryFn: () =>
      api<LookupResult>(
        `/users/lookup?ids=${encodeURIComponent(counterpartyIds.join(","))}`,
      ),
    enabled: counterpartyIds.length > 0,
    staleTime: 5 * 60_000,
  });

  const lookupMap = useMemo(() => {
    const m = new Map<string, LookupItem>();
    for (const it of lookupQuery.data?.items ?? []) m.set(it.id, it);
    return m;
  }, [lookupQuery.data]);

  if (usersQuery.isPending) {
    return (
      <div className="rounded-xl border border-border bg-white p-8 text-center text-[13px] text-ink-muted">
        Loading user…
      </div>
    );
  }
  if (!user) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-[22px] font-semibold tracking-tight text-ink">
            User not found
          </h1>
        </header>
        <div className="rounded-xl border border-border bg-white p-8">
          <p className="text-[13.5px] text-ink-muted">
            We couldn&apos;t find a user with this id. They may have been removed.
          </p>
          <Link
            to="/users"
            className="mt-4 inline-flex items-center gap-1 text-[13px] font-medium text-slate-700 hover:text-slate-900 hover:underline"
          >
            ← Back to all users
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <Link
          to="/users"
          className="inline-flex items-center gap-1 text-[12.5px] font-medium text-ink-muted hover:text-ink"
        >
          ← All users
        </Link>
        <h1 className="mt-2 break-all text-[22px] font-semibold tracking-tight text-ink">
          {user.email}
        </h1>
      </header>

      <div className="rounded-xl border border-border bg-white p-6 shadow-[0_1px_2px_0_rgba(15,23,42,0.04)]">
        <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          <DetailField label="Email" value={<span className="break-all">{user.email}</span>} />
          <DetailField
            label="Role"
            value={
              <span
                className={
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ring-1 " +
                  ROLE_PILL[user.role]
                }
              >
                {user.role}
              </span>
            }
          />
          <DetailField
            label="Status"
            value={
              user.isActive ? (
                <span className="inline-flex items-center gap-1.5 text-[13px] text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-[13px] text-ink-muted">
                  <span className="h-1.5 w-1.5 rounded-full bg-ink-subtle" />
                  Inactive
                </span>
              )
            }
          />
          <DetailField
            label="Joined"
            value={new Date(user.createdAt).toLocaleDateString(undefined, {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          />
          <DetailField
            label="User ID"
            value={
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[11.5px] text-ink-muted break-all">
                {user.id}
              </code>
            }
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-[0_1px_2px_0_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-[15px] font-semibold tracking-tight text-ink">
            Recent appointments
          </h2>
          <span className="text-[12.5px] text-ink-muted">
            {userAppointments.length}{" "}
            {userAppointments.length === 1 ? "appointment" : "appointments"}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-border bg-[#FBFCFD]">
                <Th>When</Th>
                <Th>{user.role === "doctor" ? "Patient" : "Doctor"}</Th>
                <Th>Status</Th>
                <Th>Reason</Th>
              </tr>
            </thead>
            <tbody>
              {appointmentsQuery.isPending ? (
                <tr>
                  <td colSpan={4} className="px-5 py-12 text-center text-[13px] text-ink-muted">
                    Loading…
                  </td>
                </tr>
              ) : userAppointments.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-12 text-center text-[13px] text-ink-muted">
                    No appointments on record.
                  </td>
                </tr>
              ) : (
                userAppointments.map((a) => {
                  const partyId = user.role === "doctor" ? a.patientId : a.doctorId;
                  const info = lookupMap.get(partyId);
                  const name = info?.fullName?.trim();
                  const displayName = name
                    ? info?.role === "doctor"
                      ? `Dr. ${titleCase(name)}`
                      : titleCase(name)
                    : "Unknown";
                  return (
                    <tr
                      key={a.id}
                      className="border-b border-border last:border-b-0 transition hover:bg-[#FBFCFD]"
                    >
                      <td className="px-4 py-3 text-[12.5px] text-ink tabular-nums">
                        {new Date(a.startAt).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3 text-ink">{displayName}</td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ring-1 " +
                            STATUS_PILL[a.status]
                          }
                        >
                          {a.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[12.5px] text-ink-muted">
                        {a.reason ?? "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function DetailField({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div>
      <div className="text-[10.5px] font-semibold uppercase tracking-wider text-ink-subtle">
        {label}
      </div>
      <div className="mt-1.5 text-[13.5px] text-ink">{value}</div>
    </div>
  );
}

function Th({ children }: { children: ReactNode }) {
  return (
    <th className="px-4 py-2.5 text-[11.5px] font-semibold uppercase tracking-wider text-ink-muted">
      {children}
    </th>
  );
}
