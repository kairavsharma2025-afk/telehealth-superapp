import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { requireEnv } from "@telehealth/shared";

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = resolve(here, "..", "migrations");

async function main() {
  const client = new Client({ connectionString: requireEnv("DATABASE_URL") });
  await client.connect();

  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name        TEXT PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const key = `notification-service/${file}`;
    const { rowCount } = await client.query(
      "SELECT 1 FROM _migrations WHERE name = $1",
      [key],
    );
    if (rowCount && rowCount > 0) {
      console.log(`skip   ${key}`);
      continue;
    }

    const sql = readFileSync(resolve(migrationsDir, file), "utf8");
    console.log(`apply  ${key}`);
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO _migrations (name) VALUES ($1)", [key]);
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  }

  await client.end();
  console.log("migrations complete");
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
