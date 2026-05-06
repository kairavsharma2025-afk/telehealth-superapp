// Helpers that talk directly to the gateway over HTTP. We use these to
// set up data faster than driving the UI for every prerequisite.

const GATEWAY = process.env["E2E_GATEWAY_URL"] ?? "http://localhost:4000";

interface RegisterResult {
  user: { id: string; email: string; role: "patient" | "doctor" | "admin" };
  accessToken: string;
  refreshToken: string;
}

interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  startAt: string;
  endAt: string;
  status: "scheduled" | "confirmed" | "completed" | "cancelled";
  reason: string | null;
}

export async function registerUser(
  role: "patient" | "doctor",
  password = "test12345",
): Promise<RegisterResult & { password: string }> {
  const email = `e2e-${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@e2e.example`;
  const res = await fetch(`${GATEWAY}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, role }),
  });
  if (!res.ok) throw new Error(`register failed: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as RegisterResult;
  return { ...body, password };
}

export async function bookAppointment(
  patientToken: string,
  doctorId: string,
  options: { startMs?: number; reason?: string } = {},
): Promise<Appointment> {
  const startMs = options.startMs ?? Date.now() + 24 * 3600_000;
  const startAt = new Date(startMs).toISOString();
  const endAt = new Date(startMs + 30 * 60_000).toISOString();

  const res = await fetch(`${GATEWAY}/appointments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${patientToken}`,
    },
    body: JSON.stringify({
      doctorId,
      startAt,
      endAt,
      reason: options.reason,
    }),
  });
  if (!res.ok) throw new Error(`book failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as Appointment;
}

export async function getAppointment(token: string, id: string): Promise<Appointment> {
  const res = await fetch(`${GATEWAY}/appointments/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`get failed: ${res.status}`);
  return (await res.json()) as Appointment;
}
