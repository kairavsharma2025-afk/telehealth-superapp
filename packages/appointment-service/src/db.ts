import { Pool } from "pg";
import { config } from "./config.js";
import { logger } from "./logger.js";

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
});

pool.on("error", (err) => {
  logger.error({ err }, "idle client error");
});

export async function pingDb(): Promise<void> {
  const res = await pool.query<{ ok: number }>("SELECT 1 AS ok");
  if (res.rows[0]?.ok !== 1) throw new Error("db ping returned no rows");
}
