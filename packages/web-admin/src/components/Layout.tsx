import type { ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { brand } from "@telehealth/design";
import { useAuth } from "../lib/auth";
import { Logo } from "./Logo";

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
}

const NAV: NavItem[] = [
  {
    to: "/users",
    label: "Users",
    icon: <Icon path="M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0Z M3 21a9 9 0 0 1 18 0" />,
  },
  {
    to: "/appointments",
    label: "Appointments",
    icon: <Icon path="M3 5h18M3 12h18M3 19h18" />,
  },
];

const LABEL_BY_PATH: Record<string, string> = {
  "/users": "User management",
  "/appointments": "Appointment oversight",
};

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const title = LABEL_BY_PATH[location.pathname] ?? "Admin";

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Logo size={28} color="#ffffff" />
          <div>
            <div>{brand.name}</div>
            <small>Admin Console</small>
          </div>
        </div>

        <nav aria-label="Primary">
          <span className="label">Operations</span>
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              <span className="icon" aria-hidden="true">
                {item.icon}
              </span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-line">{user?.email ?? "Signed out"}</div>
          {user ? <span className="pill pill-admin" style={{ marginTop: 6 }}>{user.role}</span> : null}
          <button onClick={logout}>Sign out</button>
        </div>
      </aside>

      <header className="topbar">
        <div className="topbar-title">{title}</div>
        <div className="topbar-meta">
          {new Date().toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </div>
      </header>

      <main className="content">{children}</main>
    </div>
  );
}

function Icon({ path }: { path: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}
