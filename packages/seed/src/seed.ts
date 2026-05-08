// Dev-only seed. TRUNCATEs users CASCADE then repopulates everything.
// Refuses to run when NODE_ENV=production.
//
// Volume defaults (override via env):
//   SEED_PATIENTS=500 SEED_DOCTORS=50 SEED_ADMINS=5
//   SEED_APPOINTMENTS=5000 SEED_UPLOADS=1000 SEED_NOTIFICATIONS=3000

import bcrypt from "bcrypt";
import { Client } from "pg";
import { requireEnv } from "@telehealth/shared";

const NUM_PATIENTS = parseInt(process.env["SEED_PATIENTS"] ?? "500", 10);
const NUM_DOCTORS = parseInt(process.env["SEED_DOCTORS"] ?? "50", 10);
const NUM_ADMINS = parseInt(process.env["SEED_ADMINS"] ?? "5", 10);
const NUM_APPOINTMENTS = parseInt(process.env["SEED_APPOINTMENTS"] ?? "5000", 10);
const NUM_UPLOADS = parseInt(process.env["SEED_UPLOADS"] ?? "1000", 10);
const NUM_NOTIFICATIONS = parseInt(process.env["SEED_NOTIFICATIONS"] ?? "3000", 10);

const FIRST = [
  "aarav", "ananya", "vihaan", "diya", "advait", "isha", "kabir", "myra",
  "reyansh", "saanvi", "arjun", "tara", "rohan", "kavya", "veer", "neha",
];
const LAST = [
  "sharma", "patel", "kumar", "singh", "rao", "iyer", "menon", "khan",
  "gupta", "agarwal", "reddy", "naidu", "joshi", "verma", "das", "shah",
];
const SPECIALTIES = [
  "General Medicine", "Cardiology", "Dermatology", "Pediatrics",
  "Psychiatry", "Orthopedics", "Gynecology", "ENT",
];

function pick<T>(arr: readonly T[]): T {
  const idx = Math.floor(Math.random() * arr.length);
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return arr[idx]!;
}
function rand(n: number): number {
  return Math.floor(Math.random() * n);
}
function makeName(): { first: string; last: string } {
  return { first: pick(FIRST), last: pick(LAST) };
}

async function main() {
  if (process.env["NODE_ENV"] === "production") {
    throw new Error("seed refuses to run with NODE_ENV=production");
  }

  const client = new Client({ connectionString: requireEnv("DATABASE_URL") });
  await client.connect();
  console.log(
    `seeding: ${NUM_PATIENTS} patients, ${NUM_DOCTORS} doctors, ${NUM_ADMINS} admins, ` +
      `${NUM_APPOINTMENTS} appts, ${NUM_UPLOADS} uploads, ${NUM_NOTIFICATIONS} notifs`,
  );

  console.log("truncating...");
  await client.query("TRUNCATE TABLE users RESTART IDENTITY CASCADE");

  // ---------------- users ----------------
  // Same hash for everyone — bcrypt(test12345). Saves time vs hashing each.
  const sharedHash = await bcrypt.hash("test12345", 12);

  const tStart = Date.now();
  const userValues: { id: string; email: string; role: string }[] = [];

  for (let i = 0; i < NUM_PATIENTS; i++) {
    const { first, last } = makeName();
    userValues.push({
      id: "",
      email: `${first}.${last}.${i}@patients.example`,
      role: "patient",
    });
  }
  for (let i = 0; i < NUM_DOCTORS; i++) {
    const { first, last } = makeName();
    userValues.push({
      id: "",
      email: `dr.${first}.${last}.${i}@doctors.example`,
      role: "doctor",
    });
  }
  for (let i = 0; i < NUM_ADMINS; i++) {
    userValues.push({
      id: "",
      email: `admin.${i}@admins.example`,
      role: "admin",
    });
  }

  // Stable test accounts — emails never change across reseeds so manual
  // login flows (smoke testing, demos) don't break when other accounts are
  // regenerated with random names.
  userValues.push({ id: "", email: "doctor@test.example", role: "doctor" });
  userValues.push({ id: "", email: "patient@test.example", role: "patient" });

  console.log("inserting users...");
  await batchInsert(
    client,
    "users",
    ["email", "password_hash", "role"],
    userValues.map((u) => [u.email, sharedHash, u.role]),
  );

  // Read back ids
  const allUsers = await client.query<{ id: string; email: string; role: string }>(
    "SELECT id, email, role FROM users ORDER BY created_at",
  );
  const patients = allUsers.rows.filter((u) => u.role === "patient");
  const doctors = allUsers.rows.filter((u) => u.role === "doctor");
  if (doctors.length === 0) throw new Error("seed failed: no doctors inserted");
  if (patients.length === 0) throw new Error("seed failed: no patients inserted");

  console.log(`  inserted ${allUsers.rowCount} users in ${Date.now() - tStart}ms`);

  // ---------------- profiles ----------------
  // Every doctor gets a profile (so every doctor has a specialty for the
  // booking UI). ~70% of patients/admins get a profile too.
  console.log("inserting profiles...");
  const profileRows = allUsers.rows
    .filter((u) => u.role === "doctor" || Math.random() < 0.7)
    .map((u) => {
      const { first, last } = makeName();
      const phone = `+91 9${rand(900000000) + 100000000}`;
      const dob = randomDateOfBirth();
      const specialty = u.role === "doctor" ? pick(SPECIALTIES) : null;
      return [u.id, `${first} ${last}`, phone, dob, specialty];
    });
  await batchInsert(
    client,
    "profiles",
    ["user_id", "full_name", "phone", "date_of_birth", "specialty"],
    profileRows,
  );
  console.log(`  inserted ${profileRows.length} profiles`);

  // ---------------- appointments ----------------
  // For each appointment: random patient, random doctor, random 30-min slot
  // in a 6-month window centered on now. Status distributed:
  //   60% scheduled, 20% confirmed, 15% completed, 5% cancelled.
  // The EXCLUDE constraint will reject overlaps; we catch and continue.
  console.log("inserting appointments...");
  const SLOT_MIN_MS = Date.now() - 90 * 24 * 3600_000;
  const SLOT_MAX_MS = Date.now() + 90 * 24 * 3600_000;
  let appointmentsInserted = 0;
  let appointmentRetries = 0;

  for (let i = 0; i < NUM_APPOINTMENTS; i++) {
    const patient = pick(patients);
    const doctor = pick(doctors);
    const startMs =
      SLOT_MIN_MS +
      Math.floor((Math.random() * (SLOT_MAX_MS - SLOT_MIN_MS)) / (30 * 60_000)) * (30 * 60_000);
    const endMs = startMs + 30 * 60_000;
    const status = pickStatus(startMs);

    try {
      await client.query(
        `INSERT INTO appointments (patient_id, doctor_id, start_at, end_at, status)
         VALUES ($1, $2, to_timestamp($3 / 1000.0), to_timestamp($4 / 1000.0), $5)`,
        [patient.id, doctor.id, startMs, endMs, status],
      );
      appointmentsInserted++;
    } catch (err: unknown) {
      // Most failures are EXCLUDE conflicts — acceptable. Bail on anything else.
      if (typeof err === "object" && err !== null && (err as { code?: string }).code === "23P01") {
        appointmentRetries++;
        continue;
      }
      if (typeof err === "object" && err !== null && (err as { code?: string }).code === "23514") {
        // patient_doctor_distinct check: same row picked for both — try again.
        appointmentRetries++;
        continue;
      }
      throw err;
    }
  }
  console.log(`  inserted ${appointmentsInserted} appointments (${appointmentRetries} skipped)`);

  // ---------------- uploads ----------------
  console.log("inserting uploads...");
  const uploadRows: unknown[][] = [];
  for (let i = 0; i < NUM_UPLOADS; i++) {
    const owner = pick(patients);
    const filename = `scan-${i}.${pick(["png", "jpg", "pdf"])}`;
    const contentType = filename.endsWith(".pdf")
      ? "application/pdf"
      : filename.endsWith(".png")
        ? "image/png"
        : "image/jpeg";
    const status = Math.random() < 0.85 ? "uploaded" : Math.random() < 0.5 ? "pending" : "deleted";
    const size = 1024 + rand(2_000_000);
    uploadRows.push([
      owner.id,
      `uploads/${owner.id}/seed-${i}`,
      filename,
      contentType,
      size,
      status,
    ]);
  }
  await batchInsert(
    client,
    "uploads",
    ["owner_user_id", "object_key", "filename", "content_type", "size_bytes", "status"],
    uploadRows,
  );
  console.log(`  inserted ${uploadRows.length} uploads`);

  // ---------------- notifications ----------------
  console.log("inserting notifications...");
  const notifRows: unknown[][] = [];
  const channels = ["email", "sms", "push"] as const;
  const templates = ["appointment_confirmed", "appointment_reminder", "manual_message"];
  for (let i = 0; i < NUM_NOTIFICATIONS; i++) {
    const recipient = pick(allUsers.rows);
    const creator = pick(allUsers.rows);
    const channel = pick(channels);
    const template = pick(templates);
    const r = Math.random();
    const status = r < 0.7 ? "sent" : r < 0.9 ? "pending" : "failed";
    notifRows.push([
      recipient.id,
      creator.id,
      channel,
      template,
      JSON.stringify({ seed: true, i }),
      status,
      status === "failed" ? "stub: forced failure" : null,
      status === "sent" ? new Date() : null,
    ]);
  }
  await batchInsert(
    client,
    "notifications",
    [
      "recipient_user_id",
      "created_by_user_id",
      "channel",
      "template",
      "payload",
      "status",
      "error_message",
      "sent_at",
    ],
    notifRows,
  );
  console.log(`  inserted ${notifRows.length} notifications`);

  console.log("\nVACUUM ANALYZE...");
  await client.query("VACUUM ANALYZE");

  console.log("\ndone.");
  await client.end();
}

function pickStatus(
  startMs: number,
): "scheduled" | "confirmed" | "completed" | "cancelled" {
  // Past appointments have already happened — they're either completed or
  // cancelled. Future appointments haven't happened yet — they're scheduled
  // (default), confirmed (the doctor accepted), or cancelled.
  const r = Math.random();
  if (startMs < Date.now()) {
    return r < 0.9 ? "completed" : "cancelled";
  }
  if (r < 0.6) return "scheduled";
  if (r < 0.9) return "confirmed";
  return "cancelled";
}

function randomDateOfBirth(): string {
  const yearsAgo = 18 + rand(60);
  const d = new Date();
  d.setFullYear(d.getFullYear() - yearsAgo);
  d.setMonth(rand(12));
  d.setDate(1 + rand(28));
  const isoDate = d.toISOString();
  const datePart = isoDate.slice(0, 10);
  return datePart;
}

async function batchInsert(
  client: Client,
  table: string,
  cols: string[],
  rows: unknown[][],
): Promise<void> {
  if (rows.length === 0) return;
  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const placeholders: string[] = [];
    const params: unknown[] = [];
    for (const row of slice) {
      const ph: string[] = [];
      for (const v of row) {
        params.push(v);
        ph.push(`$${params.length}`);
      }
      placeholders.push(`(${ph.join(", ")})`);
    }
    const sql = `INSERT INTO ${table} (${cols.join(", ")}) VALUES ${placeholders.join(", ")}`;
    await client.query(sql, params);
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
