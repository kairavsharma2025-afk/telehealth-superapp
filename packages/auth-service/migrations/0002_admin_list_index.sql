-- 0002_admin_list_index: speed up GET /admin/users.
--
-- Without this index, EXPLAIN at 5,500 rows showed:
--   Limit  ->  Sort (top-N heapsort)
--             ->  Seq Scan on users  Filter: is_active
--   Execution Time: ~3.0 ms
--
-- A partial btree on created_at DESC keyed only by active rows lets the
-- planner walk the index in order and stop after LIMIT, no sort needed.
-- Inactive users are out-of-band — they appear only when the admin opts
-- in via includeInactive=true, so excluding them from the index keeps it
-- small.

CREATE INDEX IF NOT EXISTS users_active_created_idx
  ON users (created_at DESC)
  WHERE is_active = TRUE;
