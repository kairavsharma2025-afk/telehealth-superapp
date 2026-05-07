import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

// Mobile equivalent of web-doctor/web-admin's tokenStore. Three differences:
//  1. Backed by expo-secure-store (Keychain on iOS, EncryptedSharedPreferences
//     on Android) instead of localStorage. The reads + writes are async, so
//     we cache values in module-scope variables after init() and the API
//     client reads synchronously from the cache.
//  2. init() must be awaited at app boot before rendering, otherwise the
//     first render sees null tokens and would push the user back to /login
//     even when there's a valid stored session.
//  3. setSession / clear are async — callers must await for the persisted
//     state to be durable (e.g. before navigating away after sign-in).
//
// Web platform: expo-secure-store ships an empty stub on web (Keychain and
// Keystore don't exist in browsers), so we route to localStorage instead.
// Same async surface, same in-memory cache — only the persistence backend
// differs. Same-origin storage is "secure enough" for a dev-only browser
// preview; production should run on the actual mobile platforms.

const isWeb = Platform.OS === "web";

const storage = {
  async getItem(key: string): Promise<string | null> {
    if (isWeb) {
      return typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
    }
    return SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (isWeb) {
      if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  async deleteItem(key: string): Promise<void> {
    if (isWeb) {
      if (typeof localStorage !== "undefined") localStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

const ACCESS_KEY = "telehealth_access_token";
const REFRESH_KEY = "telehealth_refresh_token";
const USER_KEY = "telehealth_user";

export interface StoredUser {
  id: string;
  email: string;
  role: "patient" | "doctor" | "admin";
}

type Listener = () => void;
const listeners = new Set<Listener>();

let initialized = false;
let initPromise: Promise<void> | null = null;
let accessToken: string | null = null;
let refreshToken: string | null = null;
let user: StoredUser | null = null;

function notify(): void {
  for (const l of listeners) l();
}

function parseUser(raw: string | null): StoredUser | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

export interface SessionUpdate {
  accessToken: string;
  refreshToken?: string;
  user?: StoredUser;
}

export const tokenStore = {
  async init(): Promise<void> {
    if (initialized) return;
    if (!initPromise) {
      initPromise = (async () => {
        const [a, r, u] = await Promise.all([
          storage.getItem(ACCESS_KEY),
          storage.getItem(REFRESH_KEY),
          storage.getItem(USER_KEY),
        ]);
        accessToken = a;
        refreshToken = r;
        user = parseUser(u);
        initialized = true;
        notify();
      })();
    }
    await initPromise;
  },
  getAccessToken(): string | null {
    return accessToken;
  },
  getRefreshToken(): string | null {
    return refreshToken;
  },
  getUser(): StoredUser | null {
    return user;
  },
  async setSession(next: SessionUpdate): Promise<void> {
    accessToken = next.accessToken;
    await storage.setItem(ACCESS_KEY, next.accessToken);
    if (next.refreshToken !== undefined) {
      refreshToken = next.refreshToken;
      await storage.setItem(REFRESH_KEY, next.refreshToken);
    }
    if (next.user !== undefined) {
      user = next.user;
      await storage.setItem(USER_KEY, JSON.stringify(next.user));
    }
    notify();
  },
  async clear(): Promise<void> {
    accessToken = null;
    refreshToken = null;
    user = null;
    notify();
    await Promise.all([
      storage.deleteItem(ACCESS_KEY),
      storage.deleteItem(REFRESH_KEY),
      storage.deleteItem(USER_KEY),
    ]);
  },
  subscribe(fn: Listener): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
