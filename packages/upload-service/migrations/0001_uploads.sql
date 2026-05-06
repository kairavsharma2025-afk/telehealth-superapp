-- 0001_uploads: metadata for client-uploaded files.
-- The actual bytes live in S3/MinIO at object_key. This table tracks who
-- owns each blob, what it claimed to be, and whether the client ever
-- finished the PUT (status flips from 'pending' -> 'uploaded' once
-- /uploads/:id/complete verifies the object exists).

CREATE TABLE IF NOT EXISTS uploads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  object_key      TEXT        NOT NULL UNIQUE,
  filename        TEXT        NOT NULL,
  content_type    TEXT        NOT NULL,
  size_bytes      BIGINT      NOT NULL CHECK (size_bytes > 0),
  status          TEXT        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'uploaded', 'deleted')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS uploads_owner_idx ON uploads (owner_user_id, created_at DESC);

DROP TRIGGER IF EXISTS uploads_set_updated_at ON uploads;
CREATE TRIGGER uploads_set_updated_at
  BEFORE UPDATE ON uploads
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
