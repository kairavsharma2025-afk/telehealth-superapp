-- 0002_specialty: per-doctor specialty.
-- Single TEXT column on profiles (not a separate table) — every doctor has
-- exactly one specialty in this model. Cardinality is small and fixed
-- enough that a CHECK constraint or enum would also be reasonable; we keep
-- it open-text so admins can introduce new specialties without a migration.
--
-- Backfill makes the dev experience nice: every existing active doctor
-- gets a random specialty (creating their profile row if missing). NOT a
-- real-world pattern — production data would come from admin tooling.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS specialty TEXT;

-- Specialty pool used by both backfill and seed.
WITH pool AS (
  SELECT unnest(ARRAY[
    'General Medicine',
    'Cardiology',
    'Dermatology',
    'Pediatrics',
    'Psychiatry',
    'Orthopedics',
    'Gynecology',
    'ENT'
  ]) AS s
),
-- Insert profiles for any doctor that has none.
ins AS (
  INSERT INTO profiles (user_id, specialty)
  SELECT
    u.id,
    (SELECT s FROM pool ORDER BY random() LIMIT 1)
  FROM users u
  LEFT JOIN profiles p ON p.user_id = u.id
  WHERE u.role = 'doctor' AND p.user_id IS NULL
  RETURNING user_id
)
SELECT 1 FROM ins;

-- Backfill specialty for doctor profiles that already exist but have NULL.
UPDATE profiles
   SET specialty = (
     SELECT s FROM (VALUES
       ('General Medicine'),('Cardiology'),('Dermatology'),('Pediatrics'),
       ('Psychiatry'),('Orthopedics'),('Gynecology'),('ENT')
     ) AS t(s) ORDER BY random() LIMIT 1
   )
  FROM users
 WHERE profiles.user_id = users.id
   AND users.role = 'doctor'
   AND profiles.specialty IS NULL;
