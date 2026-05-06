// Polling-based queue worker. Recovers notifications stuck as 'pending'
// (synchronous-API path crashed mid-send) and retries 'failed' rows with
// exponential backoff up to MAX_RETRIES.
//
// Concurrency: SELECT FOR UPDATE SKIP LOCKED. Multiple worker instances
// across processes can run simultaneously without double-sending; each
// claims its own batch.
//
// Race with the synchronous API: a fresh row inserted by POST
// /notifications is still 'pending' for the time it takes the API to
// dispatch. We avoid stealing those by only picking 'pending' rows
// older than PENDING_GRACE_SECONDS.

import { pool } from "./db.js";
import { logger } from "./logger.js";
import { dispatch } from "./lib/senders.js";
import { fetchRecipient } from "./lib/recipients.js";
import type { Channel } from "./lib/validation.js";

const MAX_RETRIES = 5;
const POLL_INTERVAL_MS = 5_000;
const BATCH_SIZE = 10;
const PENDING_GRACE_SECONDS = 30;

interface ClaimedRow {
  id: string;
  recipient_user_id: string;
  channel: Channel;
  template: string;
  payload: Record<string, unknown>;
  retries: number;
  status: "pending" | "failed";
}

let stopped = false;
let timer: NodeJS.Timeout | null = null;
let inflight: Promise<void> | null = null;

export function startWorker(): void {
  if (timer) return;
  logger.info(
    {
      pollMs: POLL_INTERVAL_MS,
      batchSize: BATCH_SIZE,
      maxRetries: MAX_RETRIES,
      pendingGraceSeconds: PENDING_GRACE_SECONDS,
    },
    "queue worker starting",
  );
  schedule();
}

export async function stopWorker(): Promise<void> {
  stopped = true;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (inflight) await inflight;
  logger.info("queue worker stopped");
}

function schedule(): void {
  if (stopped) return;
  timer = setTimeout(() => {
    inflight = tick().finally(() => {
      inflight = null;
    });
  }, POLL_INTERVAL_MS);
}

async function tick(): Promise<void> {
  try {
    const processed = await processBatch();
    if (processed > 0) logger.info({ processed }, "queue worker batch");
  } catch (err: unknown) {
    logger.error({ err }, "queue worker tick failed");
  } finally {
    schedule();
  }
}

async function processBatch(): Promise<number> {
  const client = await pool.connect();
  let processed = 0;
  try {
    await client.query("BEGIN");
    const result = await client.query<ClaimedRow>(
      `SELECT id, recipient_user_id, channel, template, payload, retries, status
         FROM notifications
        WHERE
          (status = 'pending'
            AND created_at < NOW() - make_interval(secs => $3))
          OR
          (status = 'failed'
            AND retries < $1
            AND updated_at + make_interval(secs => LEAST(power(2, retries)::int, 3600)) < NOW())
        ORDER BY created_at
        FOR UPDATE SKIP LOCKED
        LIMIT $2`,
      [MAX_RETRIES, BATCH_SIZE, PENDING_GRACE_SECONDS],
    );

    for (const row of result.rows) {
      const childLog = logger.child({
        notificationId: row.id,
        retries: row.retries,
        priorStatus: row.status,
      });
      try {
        const recipient = await fetchRecipient(row.recipient_user_id);
        await dispatch(row.channel, recipient, row.template, row.payload);
        await client.query(
          `UPDATE notifications
              SET status = 'sent',
                  error_message = NULL,
                  sent_at = NOW(),
                  retries = CASE WHEN status = 'failed' THEN retries + 1 ELSE retries END
            WHERE id = $1`,
          [row.id],
        );
        childLog.info("delivered");
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "send failed";
        await client.query(
          `UPDATE notifications
              SET status = 'failed',
                  error_message = $2,
                  retries = CASE WHEN status = 'failed' THEN retries + 1 ELSE retries END
            WHERE id = $1`,
          [row.id, message],
        );
        childLog.warn({ err }, "delivery failed; will retry with backoff");
      }
      processed++;
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
  return processed;
}
