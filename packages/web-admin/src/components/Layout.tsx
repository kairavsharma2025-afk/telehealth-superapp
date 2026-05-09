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
    to: "/",
    label: "Overview",
    icon: <Icon path="M3 12 12 4 21 12 M5 10v10h14V10" />,
  },
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
  "/": "Overview",
  "/users": "User management",
  "/appointments": "Appointment oversight",
};

function avatarInitials(email: string | undefined): string {
  if (!email) return "?";
  const local = email.split("@")[0] ?? "";
  const parts = local.split(/[._-]+/).filter(Boolean);
  const first = parts[0]?.charAt(0).toUpperCase() ?? "";
  const second = parts[1]?.charAt(0).toUpperCase() ?? "";
  return first + second || first || "?";
}

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const title =
    LABEL_BY_PATH[location.pathname] ??
    (location.pathname.startsWith("/users/") ? "User management" : "Admin");

  const initials = avatarInitials(user?.email);

  return (
    <div className="min-h-screen bg-[#F6F8FA]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[240px] flex-col border-r border-border bg-white lg:flex">
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-border">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-slate-900 text-white">
            <Logo size={20} color="#fff" />
          </span>
          <div className="leading-tight">
            <div className="flex items-center gap-1.5">
              <span className="text-[14.5px] font-semibold tracking-tight text-ink">
                {brand.name}
              </span>
              <span className="rounded bg-slate-900 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white">
                Admin
              </span>
            </div>
            <div className="text-[11.5px] text-ink-muted">Operator console</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Primary">
          <div className="px-2.5 pb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-ink-subtle">
            Operations
          </div>
          <div className="space-y-0.5">
            {NAV.map((item) => (
              <NavItemLink key={item.to} item={item} />
            ))}
          </div>
        </nav>

        <div className="border-t border-border px-4 py-4">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-slate-900 text-[12px] font-semibold text-white">
              {initials}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <div
                className="truncate text-[12.5px] font-medium text-ink"
                title={user?.email ?? "Signed out"}
              >
                {user?.email ?? "Signed out"}
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
          <div className="text-[16px] font-semibold tracking-tight text-ink">{title}</div>
          <div className="text-[12.5px] text-ink-muted">
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </div>
        </div>
      </header>

      <main className="lg:ml-[240px] mx-auto max-w-[1280px] px-6 py-8">{children}</main>
    </div>
  );
}

function NavItemLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === "/"}
      className={({ isActive }) =>
        "group relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13.5px] font-medium transition " +
        (isActive
          ? "bg-slate-100 text-ink"
          : "text-ink-muted hover:bg-[#F6F8FA] hover:text-ink")
      }
    >
      {({ isActive }) => (
        <>
          {isActive ? (
            <span
              className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-slate-900"
              aria-hidden="true"
            />
          ) : null}
          <span
            className={
              "grid h-5 w-5 place-items-center " +
              (isActive ? "text-slate-900" : "text-ink-subtle")
            }
            aria-hidden="true"
          >
            {item.icon}
          </span>
          <span className="flex-1">{item.label}</span>
        </>
      )}
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
