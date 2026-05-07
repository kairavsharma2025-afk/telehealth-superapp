import { api, ApiError } from "./api";

// Shared fetchers + types — keeps Layout, Dashboard, and Profile from
// duplicating their /users/me + /notifications signatures.

export interface MeResult {
  fullName: string | null;
  phone: string | null;
  dateOfBirth: string | null;
}

export async function fetchMe(): Promise<MeResult> {
  try {
    return await api<MeResult>("/users/me");
  } catch (err: unknown) {
    if (err instanceof ApiError && err.status === 404) {
      return { fullName: null, phone: null, dateOfBirth: null };
    }
    throw err;
  }
}

interface NotificationItem {
  id: string;
  readAt: string | null;
}
export interface NotificationsResult {
  items: NotificationItem[];
}

export function fetchNotifications(): Promise<NotificationsResult> {
  return api<NotificationsResult>("/notifications");
}

// "Last name" pulled out of fullName ("Aarav Sharma" → "Sharma"). Used
// for the topbar greeting; falls back to the literal "Doctor" so the
// header still reads cleanly when the doctor hasn't filled their
// profile yet.
export function lastNameOf(fullName: string | null | undefined): string {
  if (!fullName) return "Doctor";
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return "Doctor";
  const last = parts[parts.length - 1] ?? "";
  if (!last) return "Doctor";
  return last.charAt(0).toUpperCase() + last.slice(1);
}

// Title-case a name string ("kavya menon" → "Kavya Menon").
export function titleCase(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

// User-lookup types + display helper. The hook lives in useLookup.ts
// because it needs React; the type lives here so non-hook callers
// (display formatting) stay simple.
export interface LookupItem {
  id: string;
  fullName: string | null;
  role: "patient" | "doctor" | "admin";
}
export interface LookupResult {
  items: LookupItem[];
}

// "Aarav Sharma" / "Dr. Aarav Sharma" / "Patient #abc12345".
// Doctors get the "Dr." prefix; patients get a plain title-cased
// name. When the lookup hasn't resolved yet (or there's no profile),
// falls back to a stable "#<short-id>".
export function displayName(
  id: string,
  info: LookupItem | undefined,
  fallback: "patient" | "doctor" = "patient",
): string {
  const role = info?.role ?? fallback;
  const name = info?.fullName?.trim();
  if (name) {
    return role === "doctor" ? `Dr. ${titleCase(name)}` : titleCase(name);
  }
  return role === "doctor"
    ? `Doctor #${id.slice(0, 8)}`
    : `Patient #${id.slice(0, 8)}`;
}
