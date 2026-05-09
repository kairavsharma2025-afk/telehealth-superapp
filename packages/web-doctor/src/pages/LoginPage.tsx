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
    <div className="min-h-screen bg-[#F6F8FA] flex flex-col">
      <header className="border-b border-border/70 bg-white/70 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight text-ink">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-700 text-white">
              <Logo size={18} color="#fff" />
            </span>
            {brand.name}
          </div>
          <div className="hidden text-[13px] text-ink-muted sm:block">
            Doctor console
          </div>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-12 sm:py-16">
        <div className="w-full max-w-[420px]">
          <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-[0_1px_2px_0_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.08)]">
            <div className="h-[3px] bg-brand-700" aria-hidden="true" />

            <div className="px-7 pt-8 pb-2">
              <h1 className="text-[22px] font-semibold tracking-tight text-ink">
                Sign in
              </h1>
              <p className="mt-1.5 text-[13.5px] text-ink-muted">
                Access your clinical workspace.
              </p>
            </div>

            <form
              onSubmit={(e) => void onSubmit(e)}
              noValidate
              className="px-7 pb-7 pt-5 space-y-4"
            >
              <div className="space-y-1.5">
                <label
                  htmlFor="email"
                  className="block text-[12.5px] font-medium text-ink"
                >
                  Work email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  autoComplete="username"
                  required
                  placeholder="you@clinic.example"
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full rounded-md border border-border bg-white px-3 py-2.5 text-[14px] text-ink placeholder:text-ink-subtle outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-500/15"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="password"
                    className="block text-[12.5px] font-medium text-ink"
                  >
                    Password
                  </label>
                  <a
                    href={`mailto:${brand.supportEmail}?subject=Password%20reset`}
                    className="text-[12px] font-medium text-brand-700 hover:text-brand-800 hover:underline"
                  >
                    Forgot?
                  </a>
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  autoComplete="current-password"
                  required
                  minLength={8}
                  placeholder="••••••••"
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-md border border-border bg-white px-3 py-2.5 text-[14px] text-ink placeholder:text-ink-subtle outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-500/15"
                />
              </div>

              {error ? (
                <div
                  role="alert"
                  className="rounded-md border border-danger/20 bg-danger-subtle px-3 py-2 text-[13px] text-danger"
                >
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className="mt-1 w-full rounded-md bg-brand-700 px-4 py-2.5 text-[14px] font-semibold text-white transition hover:bg-brand-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-offset-2 active:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Signing in…" : "Sign in"}
              </button>
            </form>

            <div className="border-t border-border bg-[#FBFCFD] px-7 py-3">
              <div className="flex items-center gap-2 text-[11.5px] text-ink-muted">
                <svg
                  viewBox="0 0 16 16"
                  fill="none"
                  className="h-3.5 w-3.5 text-ink-subtle"
                  aria-hidden="true"
                >
                  <path
                    d="M4 7V5a4 4 0 1 1 8 0v2m-7 0h6a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
                Encrypted in transit · Session signed by JWT
              </div>
            </div>
          </div>

          <p className="mt-6 text-center text-[12px] text-ink-muted">
            Need access?{" "}
            <a
              href={`mailto:${brand.supportEmail}`}
              className="font-medium text-brand-700 hover:text-brand-800 hover:underline"
            >
              Contact admin
            </a>
          </p>
        </div>
      </main>

      <footer className="border-t border-border/70 bg-white/50 py-4">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 text-[11.5px] text-ink-subtle">
          <span>
            © {new Date().getFullYear()} {brand.name}
          </span>
          <span className="hidden sm:block">{brand.tagline}</span>
        </div>
      </footer>
    </div>
  );
}
