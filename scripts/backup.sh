#!/usr/bin/env bash
# Dumps the local Postgres container into a timestamped .sql.gz under backups/.
# Use `npm run db:backup` from the repo root.
#
# In Phase 7 this gets replaced with a scheduled job (AWS Backup or
# pg_dump-to-S3 cron) — the file format here is interchangeable.

set -euo pipefail

TS=$(date +%Y%m%d-%H%M%S)
OUT_DIR="$(dirname "$0")/../backups"
OUT_FILE="$OUT_DIR/telehealth-$TS.sql.gz"

mkdir -p "$OUT_DIR"

echo "dumping postgres -> $OUT_FILE"
docker compose exec -T postgres pg_dump \
  --username=telehealth \
  --dbname=telehealth \
  --format=plain \
  --no-owner \
  --no-privileges \
  | gzip > "$OUT_FILE"

bytes=$(wc -c < "$OUT_FILE" | tr -d ' ')
echo "done: $OUT_FILE ($bytes bytes)"
