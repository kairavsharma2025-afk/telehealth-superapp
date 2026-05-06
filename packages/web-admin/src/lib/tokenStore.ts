// Plain pub/sub store for auth tokens. The API client reads from here
// directly so it doesn't need to be re-hooked up every render.

const ACCESS_KEY = "telehealth.admin.accessToken";
const REFRESH_KEY = "telehealth.admin.refreshToken";
const USER_KEY = "telehealth.admin.user";

export interface StoredUser {
  id: string;
  email: string;
  role: "patient" | "doctor" | "admin";
}

type Listener = () => void;
const listeners = new Set<Listener>();

let accessToken: string | null = localStorage.getItem(ACCESS_KEY);
let refreshToken: string | null = localStorage.getItem(REFRESH_KEY);
let user: StoredUser | null = readStoredUser();

function readStoredUser(): StoredUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

export const tokenStore = {
  getAccessToken(): string | null {
    return accessToken;
  },
  getRefreshToken(): string | null {
    return refreshToken;
  },
  getUser(): StoredUser | null {
    return user;
  },
  setSession(next: { accessToken: string; refreshToken?: string; user?: StoredUser }): void {
    accessToken = next.accessToken;
    localStorage.setItem(ACCESS_KEY, next.accessToken);
    if (next.refreshToken !== undefined) {
      refreshToken = next.refreshToken;
      localStorage.setItem(REFRESH_KEY, next.refreshToken);
    }
    if (next.user !== undefined) {
      user = next.user;
      localStorage.setItem(USER_KEY, JSON.stringify(next.user));
    }
    notify();
  },
  clear(): void {
    accessToken = null;
    refreshToken = null;
    user = null;
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    notify();
  },
  subscribe(fn: Listener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

function notify() {
  for (const l of listeners) l();
}
