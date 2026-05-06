-- 0001_profiles: per-user profile data.
-- user_id mirrors auth-service.users(id). Same Postgres instance for now,
-- so we keep the FK; if/when user-service moves to its own DB, drop it
-- and rely on app-level checks.

CREATE TABLE IF NOT EXISTS profiles (
  user_id        UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  full_name      TEXT,
  phone          TEXT,
  date_of_birth  DATE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS profiles_set_updated_at ON profiles;
CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
