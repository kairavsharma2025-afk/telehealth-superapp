import { useState, type FormEvent } from "react";
import { useLocation, useNavigate, Navigate } from "react-router-dom";
import { brand } from "@telehealth/design";
import { ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Logo } from "../components/Logo";

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user) {
    const from = (location.state as { from?: string } | null)?.from ?? "/";
    return <Navigate to={from} replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
      const from = (location.state as { from?: string } | null)?.from ?? "/";
      navigate(from, { replace: true });
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : "Sign-in failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-shell">
      <aside className="auth-aside">
        <div className="auth-aside-brand">
          <Logo size={32} color="#fff" />
          {brand.name}
        </div>
        <div className="auth-aside-pitch">
          <h2>Operations control plane for the Vela network.</h2>
          <p>
            Manage clinicians, oversee appointment flow, audit sensitive actions, and keep
            the platform humming.
          </p>
        </div>
        <div className="auth-aside-meta">
          © {new Date().getFullYear()} {brand.name} · {brand.tagline}
        </div>
      </aside>

      <main className="auth-main">
        <div className="auth-form-wrap">
          <h1>Admin sign-in</h1>
          <p className="subtitle">Restricted to authorised operators.</p>

          <form onSubmit={(e) => void onSubmit(e)} noValidate>
            <div className="field">
              <label htmlFor="email">Work email</label>
              <input
                id="email"
                type="email"
                value={email}
                autoComplete="username"
                required
                placeholder="ops@vela.health"
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                autoComplete="current-password"
                required
                minLength={8}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error ? <div className="alert alert-error">{error}</div> : null}

            <button type="submit" disabled={submitting} style={{ width: "100%" }}>
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
