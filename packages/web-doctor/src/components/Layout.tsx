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

// Hospital-EMR-style sidebar grouping. The first group is the
// clinician's day-to-day workflow; the second is record-keeping +
// account.
const PRIMARY_NAV: NavItem[] = [
  {
    to: "/",
    label: "Dashboard",
    icon: <Icon path="M3 12 12 4 21 12 M5 10v10h14V10" />,
  },
  {
    to: "/appointments",
    label: "Appointments",
    icon: <Icon path="M8 2v4M16 2v4M3 10h18M5 6h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" />,
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

const SECONDARY_NAV: NavItem[] = [
  {
    to: "/documents",
    label: "Documents",
    icon: <Icon path="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M9 13h6 M9 17h6" />,
  },
  {
    to: "/notifications",
    label: "Notifications",
    icon: <Icon path="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9 M10 21a2 2 0 0 0 4 0" />,
  },
  {
    to: "/profile",
    label: "Profile",
    icon: <Icon path="M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0Z M4 21a8 8 0 0 1 16 0" />,
  },
];

export function Layout({ title, meta, children }: LayoutProps) {
  const { user } = useAuth();
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
          <span className="label">Clinical</span>
          {PRIMARY_NAV.map((item) => (
            <NavItemLink key={item.to} item={item} location={location.pathname} />
          ))}

          <span className="label">Records</span>
          {SECONDARY_NAV.map((item) => (
            <NavItemLink key={item.to} item={item} location={location.pathname} />
          ))}
        </nav>

        <div className="app-sidebar-foot">
          <div className="who">{user?.email ?? "Signed out"}</div>
          {user ? <span className="role-tag">{user.role}</span> : null}
          {/* Plain anchor to a static HTML file in public/. No React,
              no router, no bundle — Vite serves it as-is. The page
              clears localStorage and redirects to /login. */}
          <a
            href="/signout.html"
            className="btn btn-secondary"
            style={{
              marginTop: 10,
              width: "100%",
              textDecoration: "none",
              justifyContent: "center",
            }}
          >
            Sign out
          </a>
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

function NavItemLink({
  item,
  location,
}: {
  item: NavItem;
  location: string;
}) {
  const active =
    item.to === "/" ? location === "/" : location.startsWith(item.to);
  return (
    <NavLink
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
