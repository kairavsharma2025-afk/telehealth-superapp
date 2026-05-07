import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api } from "./api";
import { tokenStore, type StoredUser } from "./tokenStore";

interface LoginResponse {
  user: StoredUser;
  accessToken: string;
  refreshToken: string;
}

interface AuthContextValue {
  user: StoredUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<StoredUser | null>(() => tokenStore.getUser());

  useEffect(() => {
    return tokenStore.subscribe(() => setUser(tokenStore.getUser()));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await api<LoginResponse>("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    tokenStore.setSession({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
    });
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    // Force a hard navigation to /login. The pub/sub on tokenStore +
    // RequireAuth's <Navigate> should already redirect, but we've seen
    // edge cases where the redirect appears to be ignored — usually
    // when the user clicked from a route whose <Navigate> mounts in
    // the same render cycle as a parent re-render. Hard-replacing the
    // URL guarantees the user lands on /login with a clean app state.
    window.location.assign("/login");
  }, []);

  const value = useMemo<AuthContextValue>(() => ({ user, login, logout }), [user, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
