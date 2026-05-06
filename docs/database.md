# Database engineering (Phase 4)

This is the working notebook for the Postgres side of the system: tables, the
relationships between them, the indexes that exist, and the EXPLAIN evidence
that justified each one. Update it when schema changes.

All services share a single Postgres instance for now. Each service owns a
subset of tables and runs its own migration runner against the same database.
When (if) services split into per-service databases, the FKs across service
boundaries become app-level checks — flagged below.

## Tables

| Table | Owning service | Rows it stores |
|---|---|---|
| `users` | auth-service | identity + credentials (id, email, password_hash, role, is_active) |
| `profiles` | user-service | per-user profile (full_name, phone, dob); PK = users.id |
| `appointments` | appointment-service | bookings between a patient and a doctor |
| `uploads` | upload-service | metadata for client-uploaded files (bytes live in S3/MinIO) |
| `notifications` | notification-service | outbound message log (email/sms/push), with status |
| `_migrations` | shared | applied-migration ledger, written by every service's migrator |

## Foreign-key graph

```
users (auth-service) ────────┐
   │                         │
   │ ON DELETE CASCADE       │
   ▼                         │
profiles (user-service)      │
                             │
   ├─patient_id ON DELETE RESTRICT─►   appointments
   └─doctor_id  ON DELETE RESTRICT─►   appointments
   │
   ├─owner_user_id ON DELETE CASCADE─► uploads
   │
   ├─recipient_user_id ON DELETE CASCADE─► notifications
   └─created_by_user_id ON DELETE CASCADE─► notifications
```

`appointments` uses `RESTRICT` (you can't delete a user with live bookings) while
`uploads` and `notifications` use `CASCADE` (those rows are personal to the
user). `profiles` cascades because there's nothing meaningful to keep without
the auth row.

## Index inventory

```
appointments: appointments_pkey                    PRIMARY KEY (id)
appointments: appointments_patient_idx             btree (patient_id, start_at)
appointments: appointments_doctor_idx              btree (doctor_id, start_at)
appointments: appointments_no_doctor_overlap       EXCLUDE USING gist (doctor_id =, tstzrange(start_at, end_at, '[)') &&) WHERE status IN ('scheduled','confirmed')
appointments: appointments_start_at_idx            btree (start_at DESC)                                        ← Phase 4 add
notifications: notifications_pkey                  PRIMARY KEY (id)
notifications: notifications_recipient_idx         btree (recipient_user_id, created_at DESC)
notifications: notifications_status_idx            btree (status, created_at) WHERE status IN ('pending','failed')
profiles: profiles_pkey                            PRIMARY KEY (user_id)  -- shared with users(id)
uploads: uploads_pkey                              PRIMARY KEY (id)
uploads: uploads_object_key_key                    UNIQUE (object_key)
uploads: uploads_owner_idx                         btree (owner_user_id, created_at DESC)
uploads: uploads_active_created_idx                btree (created_at DESC) WHERE status <> 'deleted'            ← Phase 4 add
users: users_pkey                                  PRIMARY KEY (id)
users: users_email_lower_uniq                      UNIQUE btree (LOWER(email))
users: users_active_created_idx                    btree (created_at DESC) WHERE is_active = TRUE               ← Phase 4 add
```

The three indexes marked `Phase 4 add` are the entire output of the index
audit. Everything else was already present from the initial migrations.

## EXPLAIN findings (~5,500 users / 50,000 appointments / 10,000 uploads / 30,000 notifications)

### Already optimal — no change

| # | Query | Plan | Time |
|---|---|---|---|
| Q1 | `LOWER(email) = $1` (login) | Index Scan on `users_email_lower_uniq` | 0.09 ms |
| Q4 | `(patient_id = $1 OR doctor_id = $1)` (own appointments) | BitmapOr over `_patient_idx` + `_doctor_idx` | 0.32 ms |
| Q7 | doctor-overlap probe | Index Scan on `appointments_no_doctor_overlap` (GiST) | 0.77 ms |
| Q8 | uploads owner-scoped | `uploads_owner_idx` | 0.32 ms |
| Q10 | notifications recipient inbox | `notifications_recipient_idx` | 0.36 ms |
| Q11 | pending/failed notification queue | `notifications_status_idx` (partial) | 0.78 ms |

### Improved — Phase 4 indexes

Each was a Seq Scan + top-N sort before; index scan with no sort after.

| # | Query | Before | After | Speedup |
|---|---|---|---|---|
| Q2 | admin GET /users (no filter) | 3.09 ms — Seq Scan + Sort, 116 buffers | 0.37 ms — Index Scan, 8 buffers | 8.4× |
| Q3 | admin GET /users?role=patient | 2.64 ms — Seq Scan + Sort, 116 buffers | 0.29 ms — Index Scan + inline filter, 19 buffers | 9.1× |
| Q6 | admin GET /appointments | 10.04 ms — Seq Scan + Sort, **821 buffers** | 0.93 ms — Index Scan, 102 buffers | 10.8× |
| Q9 | admin GET /uploads | 3.46 ms — Seq Scan + Sort, 228 buffers | 0.23 ms — Index Scan, 6 buffers | 15.0× |

The buffer counts matter more than the milliseconds. Sub-millisecond differences
disappear in network jitter, but `821 → 102` buffer reads is real I/O the
database doesn't have to do — that scales linearly with rows for Seq Scan and
flat with rows for Index Scan.

### Notes on Q3 (role-filtered list)

The new index is `users (created_at DESC) WHERE is_active = TRUE` — it doesn't
key on `role`. PG still uses it for `WHERE is_active AND role = 'patient'`
because the index gives ordered access; the role check happens inline (`Filter:
(role = 'patient'::text)`, `Rows Removed by Filter: 510`). At our role
distribution that's cheap. If admins start filtering by role across millions of
users, replace it with `(role, created_at DESC) WHERE is_active = TRUE`.

### Notes on Q11 (worker queue)

`notifications_status_idx` is partial on `WHERE status IN ('pending', 'failed')`
and ordered by `(status, created_at)`. The current `... ORDER BY created_at` plan
uses a Bitmap Index Scan + sort because the WHERE matches two status values, so
PG can't return ordered output from the index in a single pass. When Phase 9's
worker runs a single-status query (`WHERE status = 'pending' ORDER BY created_at
LIMIT 50`), this index will give ordered access without sorting.

## Tooling

- `npm run db:seed` — `packages/seed` workspace; truncates and repopulates.
  Tunable via `SEED_PATIENTS=… SEED_APPOINTMENTS=… npm run db:seed`. Refuses
  `NODE_ENV=production`.
- `npm run db:backup` — `pg_dump | gzip` to `backups/telehealth-<ts>.sql.gz`.
- `npm run db:restore -- <file.sql.gz>` — drops the public schema and replays
  the dump. Refuses to run unless `TELEHEALTH_RESTORE_OK=1` is set, since it's
  destructive.
- `npm run db:psql` — interactive shell inside the postgres container.

## Things deferred

- **Per-service databases.** Cross-service FKs become app-level checks; the
  notification-service's recipient-lookup join (`users LEFT JOIN profiles`)
  becomes two HTTP calls or a denormalized cache. Not needed at current scale.
- **Connection pooling layer (PgBouncer).** Each service runs `pg.Pool` directly
  against Postgres. Fine until concurrent service replicas multiply.
- **Partition `notifications` by month.** Worth doing once a year of history
  exists and the active partition is the only thing the worker should touch.
- **Slow query logging.** `log_min_duration_statement` in `postgres.conf` belongs
  with Phase 9 observability work.
- **Real backups.** This script is `pg_dump` to local disk for dev. Phase 7
  swaps in `pg_dump → S3` on a cron, plus periodic restore drills.
