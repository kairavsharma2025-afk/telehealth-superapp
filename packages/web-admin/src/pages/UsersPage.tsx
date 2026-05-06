import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";

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

function listUsers(filter: RoleFilter, includeInactive: boolean): Promise<ListResult> {
  const qs = new URLSearchParams();
  if (filter !== "all") qs.set("role", filter);
  if (includeInactive) qs.set("includeInactive", "true");
  return api<ListResult>(`/admin/users${qs.toString() ? `?${qs}` : ""}`);
}

function setActive(id: string, isActive: boolean): Promise<User> {
  return api<User>(`/admin/users/${id}`, { method: "PATCH", body: { isActive } });
}

export function UsersPage() {
  const { user: me } = useAuth();
  const queryClient = useQueryClient();
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [includeInactive, setIncludeInactive] = useState(false);

  const query = useQuery<ListResult, ApiError>({
    queryKey: ["users", roleFilter, includeInactive],
    queryFn: () => listUsers(roleFilter, includeInactive),
  });

  const toggleActive = useMutation<User, ApiError, { id: string; isActive: boolean }>({
    mutationFn: ({ id, isActive }) => setActive(id, isActive),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });

  return (
    <div>
      <header className="page-header">
        <h1>Users</h1>
        <div className="filters">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
          >
            <option value="all">All roles</option>
            <option value="patient">Patients</option>
            <option value="doctor">Doctors</option>
            <option value="admin">Admins</option>
          </select>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
            />
            Include inactive
          </label>
        </div>
      </header>

      {query.isPending ? <p>Loading…</p> : null}
      {query.isError ? <p className="error">Failed: {query.error.message}</p> : null}

      <table className="data-table">
        <thead>
          <tr>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            <th>Created</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {(query.data?.items ?? []).map((u) => {
            const isSelf = me?.id === u.id;
            return (
              <tr key={u.id} className={u.isActive ? "" : "row-inactive"}>
                <td>{u.email}</td>
                <td>
                  <span className={`pill pill-${u.role}`}>{u.role}</span>
                </td>
                <td>{u.isActive ? "active" : "inactive"}</td>
                <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                <td className="actions">
                  {isSelf ? (
                    <span className="muted">you</span>
                  ) : u.isActive ? (
                    <button
                      className="danger"
                      disabled={toggleActive.isPending}
                      onClick={() => toggleActive.mutate({ id: u.id, isActive: false })}
                    >
                      Deactivate
                    </button>
                  ) : (
                    <button
                      disabled={toggleActive.isPending}
                      onClick={() => toggleActive.mutate({ id: u.id, isActive: true })}
                    >
                      Reactivate
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {toggleActive.isError ? (
        <p className="error">Action failed: {toggleActive.error.message}</p>
      ) : null}
    </div>
  );
}
