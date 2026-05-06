#!/usr/bin/env bash
# Restores from a .sql.gz produced by backup.sh.
#   npm run db:restore -- backups/telehealth-20260506-104500.sql.gz
#
# DESTRUCTIVE: drops and recreates the public schema first. Refuses to run
# unless TELEHEALTH_RESTORE_OK=1 to make accidents harder.

set -euo pipefail

if [ "${TELEHEALTH_RESTORE_OK:-}" != "1" ]; then
  echo "refusing to restore without TELEHEALTH_RESTORE_OK=1 in your env"
  echo "this drops and recreates the public schema — re-run with the env set if you mean it"
  exit 1
fi

if [ "$#" -ne 1 ]; then
  echo "usage: $0 <path-to-backup.sql.gz>"
  exit 2
fi

FILE="$1"
if [ ! -f "$FILE" ]; then
  echo "file not found: $FILE"
  exit 2
fi

echo "restoring from $FILE"

docker compose exec -T postgres psql --username=telehealth --dbname=telehealth -c \
  "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"

gunzip -c "$FILE" | docker compose exec -T postgres psql --username=telehealth --dbname=telehealth

echo "done."
