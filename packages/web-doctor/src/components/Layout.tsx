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
  const initials = avatarInitials(me.data?.fullName, "Dr");

  return (
    <div className="min-h-screen bg-[#F6F8FA]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[240px] flex-col border-r border-border bg-white lg:flex">
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-border">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-700 text-white">
            <Logo size={20} color="#fff" />
          </span>
          <div className="leading-tight">
            <div className="text-[14.5px] font-semibold tracking-tight text-ink">
              {brand.name}
            </div>
            <div className="text-[11.5px] text-ink-muted">Doctor Console</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Primary">
          <SectionLabel>Clinical</SectionLabel>
          <div className="space-y-0.5">
            {PRIMARY_NAV.map((item) => (
              <NavItemLink key={item.to} item={item} location={location.pathname} />
            ))}
          </div>

          <SectionLabel className="mt-6">Records</SectionLabel>
          <div className="space-y-0.5">
            {SECONDARY_NAV.map((item) => (
              <NavItemLink
                key={item.to}
                item={item}
                location={location.pathname}
                badge={item.to === "/notifications" ? unreadCount : 0}
              />
            ))}
          </div>
        </nav>

        <div className="border-t border-border px-4 py-4">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-brand-100 text-[12px] font-semibold text-brand-800">
              {initials}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-[12.5px] font-medium text-ink">
                {me.data?.fullName ?? user?.email ?? "Signed in"}
              </div>
              {user ? (
                <div className="text-[11px] text-ink-muted capitalize">{user.role}</div>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="mt-3 w-full rounded-md border border-border bg-white px-3 py-1.5 text-[12.5px] font-medium text-ink-muted transition hover:bg-[#F6F8FA] hover:text-ink"
          >
            Sign out
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-20 border-b border-border bg-white/80 backdrop-blur lg:ml-[240px]">
        <div className="flex h-[64px] items-center justify-between px-6">
          <div className="min-w-0">
            <div className="truncate text-[16px] font-semibold tracking-tight text-ink">
              {title}
            </div>
            <div className="truncate text-[12.5px] text-ink-muted">
              {greeting}, Dr. {lastName}.
            </div>
          </div>
          <div className="flex items-center gap-3">
            {meta ? <div className="text-[12.5px] text-ink-muted">{meta}</div> : null}
            <Link
              to="/notifications"
              className="relative grid h-9 w-9 place-items-center rounded-md border border-border bg-white text-ink-muted transition hover:bg-[#F6F8FA] hover:text-ink"
              aria-label={
                unreadCount > 0 ? `Notifications (${unreadCount} unread)` : "Notifications"
              }
            >
              <BellIcon />
              {unreadCount > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-danger ring-2 ring-white" />
              ) : null}
            </Link>
            <div
              className="grid h-9 w-9 place-items-center rounded-full bg-brand-100 text-[12px] font-semibold text-brand-800"
              aria-label={`Dr. ${lastName}`}
              title={`Dr. ${lastName}`}
            >
              {initials}
            </div>
          </div>
        </div>
      </header>

      <main className="lg:ml-[240px] mx-auto max-w-[1280px] px-6 py-8">{children}</main>
    </div>
  );
}

function SectionLabel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`px-2.5 pb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-ink-subtle ${className}`}
    >
      {children}
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
  const active = item.to === "/" ? location === "/" : location.startsWith(item.to);
  return (
    <NavLink
      to={item.to}
      end={item.to === "/"}
      className={
        "group relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13.5px] font-medium transition " +
        (active
          ? "bg-brand-50 text-brand-800"
          : "text-ink-muted hover:bg-[#F6F8FA] hover:text-ink")
      }
    >
      {active ? (
        <span
          className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-brand-700"
          aria-hidden="true"
        />
      ) : null}
      <span
        className={
          "grid h-5 w-5 place-items-center " + (active ? "text-brand-700" : "text-ink-subtle")
        }
        aria-hidden="true"
      >
        {item.icon}
      </span>
      <span className="flex-1">{item.label}</span>
      {badge > 0 ? (
        <span
          className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-brand-700 px-1.5 text-[10.5px] font-semibold text-white"
          aria-label={`${badge} unread`}
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
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function avatarInitials(fullName: string | null | undefined, fallback: string): string {
  if (!fullName) return fallback;
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return fallback;
  const first = parts[0]?.charAt(0).toUpperCase() ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.charAt(0).toUpperCase() ?? "") : "";
  return `D${(first || last) ?? fallback.charAt(1)}`;
}
