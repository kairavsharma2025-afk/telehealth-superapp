-- 0002_admin_list_index: speed up admin GET /uploads (no owner filter).
--
-- Owner-scoped reads already hit uploads_owner_idx. Only the admin
-- "all rows" path was paying for a seq scan + sort.
-- EXPLAIN at ~10k rows showed:
--   Seq Scan on uploads  Filter: status <> 'deleted' (~3.5 ms)
--
-- Partial index on created_at DESC, restricted to non-deleted rows so
-- soft-deleted entries don't bloat it.

CREATE INDEX IF NOT EXISTS uploads_active_created_idx
  ON uploads (created_at DESC)
  WHERE status <> 'deleted';
