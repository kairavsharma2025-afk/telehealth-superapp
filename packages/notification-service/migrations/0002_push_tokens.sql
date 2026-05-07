-- 0002_push_tokens: per-device push tokens.
-- A device's Expo/FCM token is unique globally and may move between users
-- (sign-out → another sign-in on the same device). On UPSERT we re-bind
-- the token to the current user. Tokens go stale when uninstall happens —
-- the caller can DELETE on sign-out, but a Phase 7 background sweeper
-- will also prune anything not seen for 90+ days.

CREATE TABLE IF NOT EXISTS push_tokens (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token         TEXT        NOT NULL UNIQUE,
  platform      TEXT        NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS push_tokens_user_id_idx ON push_tokens (user_id);
