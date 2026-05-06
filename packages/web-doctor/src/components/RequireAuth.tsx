import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";

interface Props {
  children: ReactNode;
  role?: "doctor" | "admin";
}

export function RequireAuth({ children, role }: Props) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (role && user.role !== role && user.role !== "admin") {
    return <div className="centered">Access denied — this dashboard is for {role}s.</div>;
  }
  return <>{children}</>;
}
