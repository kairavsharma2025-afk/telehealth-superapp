import { ServiceError } from "@telehealth/shared";
import { pool } from "../db.js";
import type { Recipient } from "./senders.js";

// Cross-service join: users + profiles. Both live in the same Postgres for now;
// when the services split databases this becomes two HTTP calls or a
// denormalized read replica. Keep the API consistent so the call site
// doesn't change.
export async function fetchRecipient(userId: string): Promise<Recipient> {
  const result = await pool.query<{ id: string; email: string; phone: string | null }>(
    `SELECT u.id, u.email, p.phone
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
      WHERE u.id = $1 AND u.is_active = TRUE`,
    [userId],
  );
  const row = result.rows[0];
  if (!row) throw new ServiceError("BAD_REQUEST", "Recipient does not exist or is inactive");
  return { userId: row.id, email: row.email, phone: row.phone };
}
