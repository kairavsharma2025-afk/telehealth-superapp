import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../lib/auth";

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">Telehealth Admin</div>
        <nav>
          <NavLink to="/users" className={({ isActive }) => (isActive ? "active" : "")}>
            Users
          </NavLink>
          <NavLink
            to="/appointments"
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            Appointments
          </NavLink>
        </nav>
        <div className="sidebar-footer">
          <div className="user-line">{user?.email}</div>
          <button className="link" onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
