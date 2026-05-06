-- 0002_list_index: speed up admin GET /appointments (no scope filter).
--
-- Without this index, EXPLAIN at ~50k rows showed:
--   Limit  ->  Sort (top-N heapsort)
--             ->  Seq Scan on appointments
--   Execution Time: ~10 ms (818 buffer pages read)
--
-- Patient/doctor-scoped reads already hit the per-party indexes
-- (appointments_patient_idx, appointments_doctor_idx); only the admin
-- "all rows" path was paying the seq-scan tax. A plain btree on
-- start_at DESC lets the planner stream rows in order.

CREATE INDEX IF NOT EXISTS appointments_start_at_idx
  ON appointments (start_at DESC);
