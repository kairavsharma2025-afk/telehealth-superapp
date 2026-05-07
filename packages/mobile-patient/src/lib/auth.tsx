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
import { registerPushToken, unregisterPushToken } from "./push";
import { tokenStore, type StoredUser } from "./tokenStore";

interface LoginResponse {
  user: StoredUser;
  accessToken: string;
  refreshToken: string;
}

interface AuthContextValue {
  user: StoredUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<StoredUser | null>(() => tokenStore.getUser());
  const [pushToken, setPushToken] = useState<string | null>(null);

  useEffect(() => {
    return tokenStore.subscribe(() => {
      setUser(tokenStore.getUser());
    });
  }, []);

  // Register a push token whenever a user signs in. Done here (rather
  // than at app boot) so the access token in tokenStore is already set
  // by the time push.ts hits POST /notifications/push-tokens.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void registerPushToken().then((result) => {
      if (!cancelled && result) setPushToken(result.token);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await api<LoginResponse>("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    await tokenStore.setSession({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
    });
  }, []);

  const logout = useCallback(async () => {
    // Best-effort token deregistration before we drop credentials —
    // unregisterPushToken needs a valid access token to authenticate.
    if (pushToken) await unregisterPushToken(pushToken);
    setPushToken(null);
    await tokenStore.clear();
  }, [pushToken]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, login, logout }),
    [user, login, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
