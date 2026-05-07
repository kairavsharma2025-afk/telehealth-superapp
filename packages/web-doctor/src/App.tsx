import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./lib/auth";
import { ToastProvider } from "./lib/toast";
import { RequireAuth } from "./components/RequireAuth";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { AppointmentsPage } from "./pages/AppointmentsPage";
import { AppointmentDetailPage } from "./pages/AppointmentDetailPage";
import { ConsultationPage } from "./pages/ConsultationPage";
import { SchedulePage } from "./pages/SchedulePage";
import { PatientsPage } from "./pages/PatientsPage";
import { DocumentsPage } from "./pages/DocumentsPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { ProfilePage } from "./pages/ProfilePage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 10_000 },
  },
});

// Helper: gate every doctor-only route on the same role check + auth
// requirement. Pulling it out keeps the route table scannable.
function Doctor({ children }: { children: React.ReactNode }) {
  return <RequireAuth role="doctor">{children}</RequireAuth>;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<Doctor><DashboardPage /></Doctor>} />
              <Route
                path="/appointments"
                element={<Doctor><AppointmentsPage /></Doctor>}
              />
              <Route
                path="/appointments/:id"
                element={<Doctor><AppointmentDetailPage /></Doctor>}
              />
              <Route
                path="/consultation/:id"
                element={<Doctor><ConsultationPage /></Doctor>}
              />
              <Route path="/schedule" element={<Doctor><SchedulePage /></Doctor>} />
              <Route path="/patients" element={<Doctor><PatientsPage /></Doctor>} />
              <Route path="/documents" element={<Doctor><DocumentsPage /></Doctor>} />
              <Route
                path="/notifications"
                element={<Doctor><NotificationsPage /></Doctor>}
              />
              <Route path="/profile" element={<Doctor><ProfilePage /></Doctor>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
