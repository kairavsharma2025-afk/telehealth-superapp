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
