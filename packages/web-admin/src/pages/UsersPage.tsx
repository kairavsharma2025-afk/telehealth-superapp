import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { EmptyState } from "../components/EmptyState";
import { useToast } from "../components/Toast";

interface User {
  id: string;
  email: string;
  role: "patient" | "doctor" | "admin";
  isActive: boolean;
  createdAt: string;
}
interface ListResult {
  items: User[];
}

type RoleFilter = "all" | "patient" | "doctor" | "admin";
type StatusFilter = "all" | "active" | "inactive";
type SortKey = "email" | "role" | "status" | "joined";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 25;

function listUsers(): Promise<ListResult> {
  return api<ListResult>("/admin/users?includeInactive=true");
}
function setActive(id: string, isActive: boolean): Promise<User> {
  return api<User>(`/admin/users/${id}`, { method: "PATCH", body: { isActive } });
}

const ROLE_PILL: Record<User["role"], string> = {
  patient: "bg-blue-50 text-blue-700 ring-blue-200",
  doctor: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  admin: "bg-slate-100 text-slate-800 ring-slate-300",
};

export function UsersPage() {
  const { user: me } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [searchParams] = useSearchParams();

  const [roleFilter, setRoleFilter] = useState<RoleFilter>(
    () => (searchParams.get("role") as RoleFilter | null) ?? "all",
  );
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("joined");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [roleFilter, statusFilter, search]);

  const [pendingDeactivate, setPendingDeactivate] = useState<User | null>(null);

  const query = useQuery<ListResult, ApiError>({
    queryKey: ["users", "all", true],
    queryFn: listUsers,
  });

  const toggleActive = useMutation<
    User,
    ApiError,
    { id: string; isActive: boolean; email: string }
  >({
    mutationFn: ({ id, isActive }) => setActive(id, isActive),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.show(
        `${vars.email} has been ${vars.isActive ? "reactivated" : "deactivated"}.`,
        "success",
      );
    },
    onError: (err) => {
      toast.show(err.message || "Action failed.", "error");
    },
  });

  const all = query.data?.items ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter((u) => {
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (statusFilter === "active" && !u.isActive) return false;
      if (statusFilter === "inactive" && u.isActive) return false;
      if (q && !u.email.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [all, roleFilter, statusFilter, search]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "email":
          cmp = a.email.localeCompare(b.email);
          break;
        case "role":
          cmp = a.role.localeCompare(b.role);
          break;
        case "status":
          cmp = (a.isActive ? 0 : 1) - (b.isActive ? 0 : 1);
          break;
        case "joined":
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const visible = sorted.slice(start, start + PAGE_SIZE);

  const onSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "joined" ? "desc" : "asc");
    }
  };

  const clearFilters = () => {
    setRoleFilter("all");
    setStatusFilter("all");
    setSearch("");
  };

  const filtersActive =
    roleFilter !== "all" || statusFilter !== "all" || search.trim().length > 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-ink">Users</h1>
          <p className="mt-1 text-[13px] text-ink-muted">
            Directory of every user on the platform.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <span
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle"
              aria-hidden="true"
            >
              <SearchIcon />
            </span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by email…"
              aria-label="Search by email"
              className="w-[260px] rounded-md border border-border bg-white py-2 pl-9 pr-3 text-[13px] text-ink placeholder:text-ink-subtle outline-none transition focus:border-slate-700 focus:ring-2 focus:ring-slate-500/15"
            />
          </div>
          <Select
            value={roleFilter}
            onChange={(v) => setRoleFilter(v as RoleFilter)}
            ariaLabel="Filter by role"
            options={[
              { value: "all", label: "All roles" },
              { value: "patient", label: "Patients" },
              { value: "doctor", label: "Doctors" },
              { value: "admin", label: "Admins" },
            ]}
          />
          <Select
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as StatusFilter)}
            ariaLabel="Filter by status"
            options={[
              { value: "all", label: "All statuses" },
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
            ]}
          />
        </div>
      </header>

      {query.isError ? (
        <div className="rounded-md border border-danger/20 bg-danger-subtle px-3.5 py-2.5 text-[13px] text-danger">
          Failed: {query.error.message}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-[0_1px_2px_0_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-[15px] font-semibold tracking-tight text-ink">Directory</h2>
          <span className="text-[12.5px] text-ink-muted">
            {sorted.length} {sorted.length === 1 ? "user" : "users"}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-border bg-[#FBFCFD]">
                <SortableTh
                  label="Email"
                  sortKey="email"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={onSort}
                />
                <SortableTh
                  label="Role"
                  sortKey="role"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={onSort}
                />
                <SortableTh
                  label="Status"
                  sortKey="status"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={onSort}
                />
                <SortableTh
                  label="Joined"
                  sortKey="joined"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={onSort}
                />
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {query.isPending ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-[13px] text-ink-muted">
                    Loading…
                  </td>
                </tr>
              ) : visible.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-0">
                    <EmptyState
                      title="No results found"
                      description={
                        filtersActive
                          ? "No users match these filters."
                          : "There are no users to show yet."
                      }
                      action={
                        filtersActive ? (
                          <button
                            onClick={clearFilters}
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
                visible.map((u) => {
                  const isSelf = me?.id === u.id;
                  return (
                    <tr
                      key={u.id}
                      onClick={() => navigate(`/users/${u.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          navigate(`/users/${u.id}`);
                        }
                      }}
                      tabIndex={0}
                      role="link"
                      aria-label={`Open ${u.email}`}
                      className={
                        "cursor-pointer border-b border-border transition focus:outline-none focus:ring-2 focus:ring-inset focus:ring-slate-500/30 last:border-b-0 " +
                        (u.isActive ? "hover:bg-[#FBFCFD]" : "bg-[#FAFAFA] hover:bg-[#F4F6F8]")
                      }
                    >
                      <td className="px-4 py-3">
                        <Link
                          to={`/users/${u.id}`}
                          className="font-medium text-ink hover:text-slate-700 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {u.email}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ring-1 " +
                            ROLE_PILL[u.role]
                          }
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[12.5px] text-ink-muted">
                        {u.isActive ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-ink-subtle" />
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[12.5px] text-ink-muted tabular-nums">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        {isSelf ? (
                          <span className="text-[12px] text-ink-subtle">you</span>
                        ) : u.isActive ? (
                          <button
                            disabled={toggleActive.isPending}
                            onClick={() => setPendingDeactivate(u)}
                            className="rounded-md px-2.5 py-1 text-[12.5px] font-medium text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
                          >
                            Deactivate
                          </button>
                        ) : (
                          <button
                            disabled={toggleActive.isPending}
                            onClick={() =>
                              toggleActive.mutate({
                                id: u.id,
                                isActive: true,
                                email: u.email,
                              })
                            }
                            className="rounded-md border border-border bg-white px-2.5 py-1 text-[12.5px] font-medium text-ink transition hover:bg-[#F6F8FA] disabled:opacity-50"
                          >
                            Reactivate
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {visible.length > 0 ? (
          <div className="flex items-center justify-between border-t border-border bg-[#FBFCFD] px-5 py-3">
            <span className="text-[12px] text-ink-muted tabular-nums">
              Page {safePage} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label="Previous page"
                className="rounded-md border border-border bg-white px-2.5 py-1 text-[12.5px] font-medium text-ink transition hover:bg-[#F6F8FA] disabled:cursor-not-allowed disabled:opacity-50"
              >
                ← Previous
              </button>
              <button
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Next page"
                className="rounded-md border border-border bg-white px-2.5 py-1 text-[12.5px] font-medium text-ink transition hover:bg-[#F6F8FA] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next →
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <ConfirmDialog
        open={pendingDeactivate !== null}
        title="Deactivate this user?"
        description={
          pendingDeactivate ? (
            <>
              Are you sure you want to deactivate{" "}
              <strong>{pendingDeactivate.email}</strong>? They will lose access
              immediately.
            </>
          ) : null
        }
        confirmLabel="Deactivate"
        cancelLabel="Cancel"
        destructive
        busy={toggleActive.isPending}
        onCancel={() => setPendingDeactivate(null)}
        onConfirm={() => {
          if (!pendingDeactivate) return;
          toggleActive.mutate(
            {
              id: pendingDeactivate.id,
              isActive: false,
              email: pendingDeactivate.email,
            },
            {
              onSettled: () => setPendingDeactivate(null),
            },
          );
        }}
      />
    </div>
  );
}

function SortableTh({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  dir: SortDir;
  onSort: (k: SortKey) => void;
}) {
  const active = activeKey === sortKey;
  return (
    <th className="px-4 py-2.5">
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        aria-label={`Sort by ${label}${active ? ` (currently ${dir}ending)` : ""}`}
        aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
        className="inline-flex items-center gap-1 text-[11.5px] font-semibold uppercase tracking-wider text-ink-muted transition hover:text-ink"
      >
        {label}
        <span className="text-[10px]" aria-hidden="true">
          {active ? (dir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
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
}): ReactNode {
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

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="7" cy="7" r="5" />
      <path d="m13 13-2.5-2.5" />
    </svg>
  );
}
