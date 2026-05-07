-- Demo seeder: gives doctor@test.local appointments with 10 randomly-
-- chosen seeded patients, spread across the next ~5 days in 6-hour
-- increments starting 72h from now (offset chosen to avoid colliding
-- with whatever near-term test appointments are already booked).
-- Mix of statuses (scheduled / confirmed / completed) so the
-- dashboard tabs all have content.
--
-- Idempotent-ish: the EXCLUDE constraint on appointments will reject
-- a re-run that hits an overlapping slot. Bump the +72h base or
-- TRUNCATE the doctor's existing rows first if you want a clean
-- re-seed.
--
-- Run with:
--   docker compose exec -T postgres psql -U telehealth -d telehealth \
--     < scripts/seed-doctor-appointments.sql

WITH doc AS (
  SELECT id FROM users WHERE email = 'doctor@test.local'
),
pool AS (
  SELECT u.id
    FROM users u
    JOIN profiles p ON p.user_id = u.id
   WHERE u.role = 'patient'
     AND u.email <> 'patient@test.local'
     AND p.full_name IS NOT NULL
   ORDER BY random()
   LIMIT 10
),
reasons AS (
  SELECT unnest(ARRAY[
    'Annual check-up',
    'Follow-up on lab results',
    'Persistent headache',
    'Skin rash on arms',
    'Lower back pain',
    'Cough for two weeks',
    'Sleep difficulty',
    'Medication review',
    'Sore throat',
    'Dizziness'
  ]) AS reason
),
numbered AS (
  SELECT p.id AS patient_id, row_number() OVER () AS rn FROM pool p
),
reason_numbered AS (
  SELECT reason, row_number() OVER () AS rn FROM reasons
)
INSERT INTO appointments (patient_id, doctor_id, start_at, end_at, status, reason)
SELECT
  n.patient_id,
  (SELECT id FROM doc),
  date_trunc('hour', NOW()) + interval '72 hours' + (n.rn * interval '6 hours'),
  date_trunc('hour', NOW()) + interval '72 hours' + (n.rn * interval '6 hours') + interval '30 minutes',
  CASE
    WHEN n.rn % 3 = 0 THEN 'confirmed'
    WHEN n.rn % 5 = 0 THEN 'completed'
    ELSE 'scheduled'
  END,
  r.reason
FROM numbered n
JOIN reason_numbered r ON r.rn = n.rn;

-- Verify.
SELECT a.start_at, a.status, p.full_name AS patient
  FROM appointments a
  JOIN users d ON d.id = a.doctor_id
  JOIN profiles p ON p.user_id = a.patient_id
 WHERE d.email = 'doctor@test.local'
 ORDER BY a.start_at;
