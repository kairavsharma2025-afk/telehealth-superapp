import type { ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { brand } from "@telehealth/design";
import { useAuth } from "../lib/auth";
import {
  fetchMe,
  fetchNotifications,
  lastNameOf,
  type MeResult,
  type NotificationsResult,
} from "../lib/queries";
import type { ApiError } from "../lib/api";
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
  const { user, logout } = useAuth();
  const location = useLocation();

  // Pull profile + unread count once at the shell level — both screens
  // that need them (greeting in topbar, dot on the Notifications nav
  // row) read from the same query cache. staleTime keeps refetches
  // calm.
  const me = useQuery<MeResult, ApiError>({
    queryKey: ["me"],
    queryFn: fetchMe,
    staleTime: 60_000,
  });
  const notifs = useQuery<NotificationsResult, ApiError>({
    queryKey: ["notifications"],
    queryFn: fetchNotifications,
    staleTime: 30_000,
  });
  const unreadCount = (notifs.data?.items ?? []).filter((n) => !n.readAt).length;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const lastName = lastNameOf(me.data?.fullName);

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
            <NavItemLink
              key={item.to}
              item={item}
              location={location.pathname}
              badge={item.to === "/notifications" ? unreadCount : 0}
            />
          ))}
        </nav>

        <div className="app-sidebar-foot">
          <div className="who">{user?.email ?? "Signed out"}</div>
          {user ? <span className="role-tag">{user.role}</span> : null}
          <button
            type="button"
            onClick={logout}
            className="btn-secondary"
            style={{ marginTop: 10, width: "100%" }}
          >
            Sign out
          </button>
        </div>
      </aside>

      <header className="app-topbar">
        <div>
          <div className="app-topbar-title">{title}</div>
          <div className="app-topbar-meta">
            {greeting}, Dr. {lastName}.
          </div>
        </div>
        <div className="app-topbar-right">
          <div className="app-topbar-meta">{meta}</div>
          <Link
            to="/notifications"
            className="topbar-bell"
            aria-label={
              unreadCount > 0
                ? `Notifications (${unreadCount} unread)`
                : "Notifications"
            }
          >
            <BellIcon />
            {unreadCount > 0 ? <span className="topbar-bell-dot" /> : null}
          </Link>
          <div
            className="topbar-avatar"
            aria-label={`Dr. ${lastName}`}
            title={`Dr. ${lastName}`}
          >
            {avatarInitials(me.data?.fullName, "Dr")}
          </div>
        </div>
      </header>

      <main className="app-main">{children}</main>
    </div>
  );
}

function NavItemLink({
  item,
  location,
  badge = 0,
}: {
  item: NavItem;
  location: string;
  badge?: number;
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
      <span style={{ flex: 1 }}>{item.label}</span>
      {badge > 0 ? (
        <span
          className="nav-badge"
          aria-label={`${badge} unread`}
          title={`${badge} unread`}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
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

function BellIcon() {
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
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

// Avatar initials: prefer the first letter of the doctor's first +
// last name, fall back to the literal "Dr" so the chip never reads
// "??" while the profile is still loading.
function avatarInitials(fullName: string | null | undefined, fallback: string): string {
  if (!fullName) return fallback;
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return fallback;
  const first = parts[0]?.charAt(0).toUpperCase() ?? "";
  const last = parts.length > 1
    ? (parts[parts.length - 1]?.charAt(0).toUpperCase() ?? "")
    : "";
  return `D${(first || last) ?? fallback.charAt(1)}`;
}
