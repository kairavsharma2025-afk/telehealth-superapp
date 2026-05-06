import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./lib/auth";
import { RequireAdmin } from "./components/RequireAuth";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/LoginPage";
import { UsersPage } from "./pages/UsersPage";
import { AppointmentsPage } from "./pages/AppointmentsPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 10_000 },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/"
              element={
                <RequireAdmin>
                  <Layout>
                    <Navigate to="/users" replace />
                  </Layout>
                </RequireAdmin>
              }
            />
            <Route
              path="/users"
              element={
                <RequireAdmin>
                  <Layout>
                    <UsersPage />
                  </Layout>
                </RequireAdmin>
              }
            />
            <Route
              path="/appointments"
              element={
                <RequireAdmin>
                  <Layout>
                    <AppointmentsPage />
                  </Layout>
                </RequireAdmin>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
