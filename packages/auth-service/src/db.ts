import { Pool } from "pg";
import { config } from "./config.js";

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
});

pool.on("error", (err) => {
  console.error("[db] idle client error", err);
});

export async function pingDb(): Promise<void> {
  const res = await pool.query<{ ok: number }>("SELECT 1 AS ok");
  if (res.rows[0]?.ok !== 1) throw new Error("db ping returned no rows");
}
