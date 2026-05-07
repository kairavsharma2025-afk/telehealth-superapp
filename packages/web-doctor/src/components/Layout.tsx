import type { ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { brand } from "@telehealth/design";
import { useAuth } from "../lib/auth";
import { Logo } from "./Logo";

interface LayoutProps {
  title: string;
  meta?: ReactNode;
  children: ReactNode;
}

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
}

const NAV: NavItem[] = [
  {
    to: "/",
    label: "Dashboard",
    icon: <Icon path="M3 12 12 4 21 12 M5 10v10h14V10" />,
  },
  {
    to: "/schedule",
    label: "Schedule",
    icon: <Icon path="M3 5h18M3 12h18M3 19h18" />,
  },
  {
    to: "/patients",
    label: "Patients",
    icon: <Icon path="M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0Z M3 21a9 9 0 0 1 18 0" />,
  },
];

export function Layout({ title, meta, children }: LayoutProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="app-sidebar-brand">
          <Logo size={28} color="var(--color-brand-700)" />
          <div>
            <div>{brand.name}</div>
            <small>Doctor Console</small>
          </div>
        </div>

        <nav className="app-sidebar-nav" aria-label="Primary">
          <span className="label">Workspace</span>
          {NAV.map((item) => {
            const active =
              item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={active ? "active" : ""}
                end={item.to === "/"}
              >
                <span className="icon" aria-hidden="true">
                  {item.icon}
                </span>
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="app-sidebar-foot">
          <div className="who">{user?.email ?? "Signed out"}</div>
          {user ? <span className="role-tag">{user.role}</span> : null}
          <button onClick={logout}>Sign out</button>
        </div>
      </aside>

      <header className="app-topbar">
        <div>
          <div className="app-topbar-title">{title}</div>
          <div className="app-topbar-meta">
            {greeting}
            {user?.email ? `, Dr. ${user.email.split("@")[0]}.` : "."}
          </div>
        </div>
        <div className="app-topbar-meta">{meta}</div>
      </header>

      <main className="app-main">{children}</main>
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
