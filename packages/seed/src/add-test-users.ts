// Inserts two stable test accounts (doctor@test.example, patient@test.example)
// without touching any other data. Idempotent — safe to re-run.

import bcrypt from "bcrypt";
import { Client } from "pg";
import { requireEnv } from "@telehealth/shared";

async function main() {
  const client = new Client({ connectionString: requireEnv("DATABASE_URL") });
  await client.connect();

  const hash = await bcrypt.hash("test12345", 12);

  const accounts = [
    { email: "doctor@test.example", role: "doctor", fullName: "Test Doctor", specialty: "General Medicine" },
    { email: "patient@test.example", role: "patient", fullName: "Test Patient", specialty: null },
  ];

  for (const a of accounts) {
    const existing = await client.query<{ id: string }>(
      "SELECT id FROM users WHERE LOWER(email) = LOWER($1)",
      [a.email],
    );

    let userId: string;
    if (existing.rows[0]) {
      userId = existing.rows[0].id;
      await client.query(
        "UPDATE users SET password_hash = $1, role = $2, is_active = TRUE WHERE id = $3",
        [hash, a.role, userId],
      );
    } else {
      const inserted = await client.query<{ id: string }>(
        "INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id",
        [a.email, hash, a.role],
      );
      userId = inserted.rows[0]!.id;
    }

    await client.query(
      `INSERT INTO profiles (user_id, full_name, phone, date_of_birth, specialty)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id) DO UPDATE
         SET full_name = EXCLUDED.full_name, specialty = EXCLUDED.specialty`,
      [userId, a.fullName, "+91 9000000000", "1990-01-01", a.specialty],
    );

    console.log(`  ${a.role.padEnd(8)} ${a.email}  password: test12345`);
  }

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
