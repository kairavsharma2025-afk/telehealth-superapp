import { MongoClient, type Collection } from "mongodb";
import type { Logger } from "./logger.js";

// Append-only audit log of sensitive admin actions, persisted to Mongo
// (the unstructured-store side of the architecture — Mongo was provisioned
// in Phase 2 for exactly this kind of flexible-shape audit/log payload,
// while Postgres remains the system-of-record for users/appointments/etc).
//
// Best-effort by design: a Mongo outage MUST NOT break the admin's
// user-facing request. We catch + log instead of rethrowing. For a real
// production deployment with hard compliance requirements you'd queue
// audit events durably (e.g. write to a `pending_audit` Postgres table
// in the same txn, then a worker drains to Mongo) — Phase 7+ work.

export interface AuditEvent {
  service: string;
  action: string;
  actor: { userId: string; role: string };
  target: { type: string; id: string };
  details?: Record<string, unknown> | undefined;
  requestId?: string | undefined;
}

export interface AuditLogger {
  record: (event: AuditEvent) => Promise<void>;
  close: () => Promise<void>;
}

export interface CreateAuditOptions {
  url: string | undefined;
  dbName?: string;
  collectionName?: string;
  logger: Logger;
}

const DEFAULT_COLLECTION = "audit_log";

export function createAuditLogger(opts: CreateAuditOptions): AuditLogger {
  if (!opts.url) {
    opts.logger.warn("audit log disabled (no MONGO_URL configured)");
    return {
      record: () => Promise.resolve(),
      close: () => Promise.resolve(),
    };
  }

  const url = opts.url;
  const collectionName = opts.collectionName ?? DEFAULT_COLLECTION;
  const log = opts.logger;
  let client: MongoClient | null = null;
  let coll: Collection<AuditEvent & { timestamp: Date }> | null = null;
  let connectPromise: Promise<void> | null = null;

  function ensure(): Promise<void> {
    if (coll) return Promise.resolve();
    if (!connectPromise) {
      connectPromise = (async () => {
        const c = new MongoClient(url);
        await c.connect();
        const db = opts.dbName ? c.db(opts.dbName) : c.db();
        const collection = db.collection<AuditEvent & { timestamp: Date }>(collectionName);
        await Promise.all([
          collection.createIndex({ timestamp: -1 }),
          collection.createIndex({ "actor.userId": 1 }),
          collection.createIndex({ "target.type": 1, "target.id": 1 }),
        ]);
        client = c;
        coll = collection;
        log.info({ db: db.databaseName, collection: collectionName }, "audit log connected");
      })().catch((err: unknown) => {
        log.error({ err }, "audit log connect failed; will retry on next record");
        connectPromise = null;
        throw err;
      });
    }
    return connectPromise;
  }

  return {
    async record(event) {
      try {
        await ensure();
        if (!coll) return;
        await coll.insertOne({ ...event, timestamp: new Date() });
      } catch (err: unknown) {
        log.error({ err, event }, "audit record dropped");
      }
    },
    async close() {
      if (client) {
        await client.close();
        client = null;
        coll = null;
      }
    },
  };
}
