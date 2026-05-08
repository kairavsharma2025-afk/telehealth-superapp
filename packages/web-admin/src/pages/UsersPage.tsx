import { useEffect, useMemo, useState } from "react";
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
  // Always pull every user (active + inactive); we filter client-side
  // so the same response can answer multiple filter combinations
  // without re-hitting the server on every checkbox flip.
  return api<ListResult>("/admin/users?includeInactive=true");
}

function setActive(id: string, isActive: boolean): Promise<User> {
  return api<User>(`/admin/users/${id}`, { method: "PATCH", body: { isActive } });
}

export function UsersPage() {
  const { user: me } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [searchParams] = useSearchParams();

  // Filters / sort / pagination state.
  const [roleFilter, setRoleFilter] = useState<RoleFilter>(
    () => (searchParams.get("role") as RoleFilter | null) ?? "all",
  );
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("joined");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);

  // Reset page to 1 whenever a filter or search changes.
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
          // Active before inactive when ascending.
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
    <div>
      <header className="page-header">
        <h1>Users</h1>
        <div className="filters">
          <div className="search-box">
            <SearchIcon />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by email…"
              aria-label="Search by email"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
            aria-label="Filter by role"
          >
            <option value="all">All roles</option>
            <option value="patient">Patients</option>
            <option value="doctor">Doctors</option>
            <option value="admin">Admins</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            aria-label="Filter by status"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </header>

      {query.isError ? (
        <div className="alert alert-error">Failed: {query.error.message}</div>
      ) : null}

      <div className="card">
        <div className="card-header">
          <h2>Directory</h2>
          <span className="muted">
            {sorted.length} {sorted.length === 1 ? "user" : "users"}
          </span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
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
              <th></th>
            </tr>
          </thead>
          <tbody>
            {query.isPending ? (
              <tr>
                <td colSpan={5} className="muted" style={{ padding: 24 }}>
                  Loading…
                </td>
              </tr>
            ) : visible.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 0 }}>
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
                          className="secondary"
                          onClick={clearFilters}
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
                    className={`row-clickable ${u.isActive ? "" : "row-inactive"}`}
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
                  >
                    <td>
                      <Link
                        to={`/users/${u.id}`}
                        className="row-email-link"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {u.email}
                      </Link>
                    </td>
                    <td>
                      <span className={`pill pill-${u.role}`}>{u.role}</span>
                    </td>
                    <td className="muted">{u.isActive ? "Active" : "Inactive"}</td>
                    <td className="muted">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="actions" onClick={(e) => e.stopPropagation()}>
                      {isSelf ? (
                        <span className="muted">you</span>
                      ) : u.isActive ? (
                        <button
                          className="danger"
                          disabled={toggleActive.isPending}
                          onClick={() => setPendingDeactivate(u)}
                        >
                          Deactivate
                        </button>
                      ) : (
                        <button
                          className="secondary"
                          disabled={toggleActive.isPending}
                          onClick={() =>
                            toggleActive.mutate({
                              id: u.id,
                              isActive: true,
                              email: u.email,
                            })
                          }
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

        {visible.length > 0 ? (
          <div className="pagination">
            <span className="muted">
              Page {safePage} of {totalPages}
            </span>
            <div className="pagination-actions">
              <button
                className="secondary"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label="Previous page"
              >
                ← Previous
              </button>
              <button
                className="secondary"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Next page"
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
    <th>
      <button
        type="button"
        className="th-sort-btn"
        onClick={() => onSort(sortKey)}
        aria-label={`Sort by ${label}${active ? ` (currently ${dir}ending)` : ""}`}
        aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
      >
        {label}
        <span className="th-sort-arrow" aria-hidden="true">
          {active ? (dir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );
}

function SearchIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}
