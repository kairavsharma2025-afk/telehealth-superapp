import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (user.role !== "admin") {
    return (
      <div className="centered">
        <div className="card">
          <h1>Admin only</h1>
          <p className="muted">
            This console is admin-only. You&apos;re signed in as {user.role}.
          </p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
