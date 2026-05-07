-- One-off: ensure every user has a profile.full_name. Picks a random
-- first+last per row from the same name pool the seed uses, so the
-- backfilled names blend with the seeded data. Idempotent — only
-- touches rows missing a profile or with NULL full_name.
--
-- Run with:
--   docker compose exec -T postgres psql -U telehealth -d telehealth \
--     < scripts/backfill-names.sql

-- Step 1: insert a profile for users without one.
INSERT INTO profiles (user_id, full_name)
SELECT
  u.id,
  (ARRAY[
    'aarav','ananya','vihaan','diya','advait','isha','kabir','myra',
    'reyansh','saanvi','arjun','tara','rohan','kavya','veer','neha'
  ])[1 + floor(random() * 16)::int]
  || ' ' ||
  (ARRAY[
    'sharma','patel','kumar','singh','rao','iyer','menon','khan',
    'gupta','agarwal','reddy','naidu','joshi','verma','das','shah'
  ])[1 + floor(random() * 16)::int]
FROM users u
LEFT JOIN profiles p ON p.user_id = u.id
WHERE p.user_id IS NULL;

-- Step 2: fill any existing profile rows where full_name is still NULL.
UPDATE profiles
   SET full_name = (ARRAY[
       'aarav','ananya','vihaan','diya','advait','isha','kabir','myra',
       'reyansh','saanvi','arjun','tara','rohan','kavya','veer','neha'
     ])[1 + floor(random() * 16)::int]
     || ' ' ||
     (ARRAY[
       'sharma','patel','kumar','singh','rao','iyer','menon','khan',
       'gupta','agarwal','reddy','naidu','joshi','verma','das','shah'
     ])[1 + floor(random() * 16)::int]
 WHERE full_name IS NULL;

-- Report.
SELECT
  COUNT(*) FILTER (WHERE p.full_name IS NULL) AS still_missing,
  COUNT(*) FILTER (WHERE p.full_name IS NOT NULL) AS have_name,
  COUNT(*) AS total
FROM users u
LEFT JOIN profiles p ON p.user_id = u.id;
