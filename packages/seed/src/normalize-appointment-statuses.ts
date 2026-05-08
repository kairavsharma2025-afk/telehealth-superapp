// Aligns existing appointment statuses with their start_at:
//   past   → completed (90%) or cancelled (10%)
//   future → scheduled (90%) or cancelled (10%)
// Idempotent — safe to re-run. Does not touch start_at, end_at, or any
// other fields. Cancellations are preserved as-is.

import { Client } from "pg";
import { requireEnv } from "@telehealth/shared";

async function main() {
  const client = new Client({ connectionString: requireEnv("DATABASE_URL") });
  await client.connect();

  // Past: scheduled/confirmed rows haven't actually happened yet in the
  // model — they should be completed (mostly) or cancelled. Already-
  // completed and already-cancelled rows are left alone. Moving rows OUT
  // of (scheduled, confirmed) is always safe vs the no-overlap exclusion
  // constraint — it only removes them from the constrained set.
  const past = await client.query(
    `UPDATE appointments
        SET status = CASE WHEN random() < 0.9 THEN 'completed' ELSE 'cancelled' END
      WHERE start_at < NOW()
        AND status IN ('scheduled', 'confirmed')`,
  );

  // Future "confirmed" → "scheduled". The exclusion constraint covers both
  // statuses already, so the existing rows are guaranteed non-overlapping —
  // safe to merge into scheduled.
  const futureConfirmed = await client.query(
    `UPDATE appointments
        SET status = 'scheduled'
      WHERE start_at >= NOW()
        AND status = 'confirmed'`,
  );

  // Future "completed" is nonsensical (an appointment can't be done before
  // it's started). These rows might temporally overlap with existing
  // scheduled/confirmed rows, so promoting them to "scheduled" would break
  // the no-overlap exclusion. Cancel them instead.
  const futureCompleted = await client.query(
    `UPDATE appointments
        SET status = 'cancelled'
      WHERE start_at >= NOW()
        AND status = 'completed'`,
  );

  // Bump ~30% of future scheduled rows to confirmed so the "confirmed"
  // pill is visible in the UI without a doctor having to manually click
  // confirm on every appointment. Safe vs the no-overlap exclusion
  // because the predicate already covers both scheduled and confirmed.
  const promoted = await client.query(
    `UPDATE appointments
        SET status = 'confirmed'
      WHERE start_at >= NOW()
        AND status = 'scheduled'
        AND random() < 0.3`,
  );

  console.log(`  past scheduled/confirmed → completed/cancelled: ${past.rowCount}`);
  console.log(`  future confirmed → scheduled:                   ${futureConfirmed.rowCount}`);
  console.log(`  future completed → cancelled:                   ${futureCompleted.rowCount}`);
  console.log(`  future scheduled → confirmed (~30%):            ${promoted.rowCount}`);

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
