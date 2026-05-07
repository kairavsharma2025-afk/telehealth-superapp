import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, ApiError } from "./api";
import { registerPushToken, unregisterPushToken } from "./push";
import { tokenStore, type StoredUser } from "./tokenStore";

// This app is the patient experience only. Doctors/admins who sign in
// here should be turned away with a clear redirect to their own
// console; otherwise they'd land on the booking + appointments UI
// which has nothing to offer them.
function assertPatientRole(user: StoredUser): void {
  if (user.role !== "patient") {
    throw new ApiError(
      403,
      `This app is for patients. ${
        user.role === "doctor"
          ? "Doctors should use the Vela Health doctor console at http://localhost:5173."
          : "Admins should use the admin console at http://localhost:5174."
      }`,
      "WRONG_APP_FOR_ROLE",
    );
  }
}

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
  // Wrap the initial read so a stale non-patient session in
  // localStorage (e.g. a doctor who previously signed in here) doesn't
  // bypass the role check.
  const [user, setUser] = useState<StoredUser | null>(() => {
    const stored = tokenStore.getUser();
    if (stored && stored.role !== "patient") {
      void tokenStore.clear();
      return null;
    }
    return stored;
  });
  const [pushToken, setPushToken] = useState<string | null>(null);

  useEffect(() => {
    return tokenStore.subscribe(() => {
      const next = tokenStore.getUser();
      if (next && next.role !== "patient") {
        void tokenStore.clear();
        setUser(null);
        return;
      }
      setUser(next);
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
    // Reject non-patient sessions BEFORE persisting them — this throws
    // a friendly ApiError that LoginScreen surfaces in the form, and
    // never writes the doctor's tokens to localStorage.
    assertPatientRole(result.user);
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
