-- 0001_notifications: outbound message tracking.
-- Phase 3: synchronous send-on-create. The pending state is mostly a
-- transient — rows are inserted as 'pending' and flipped to 'sent' or
-- 'failed' before the request returns. Phase 9 introduces a worker that
-- polls 'pending' / retries 'failed', at which point this table doubles
-- as the queue.

CREATE TABLE IF NOT EXISTS notifications (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_by_user_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel             TEXT        NOT NULL CHECK (channel IN ('email', 'sms', 'push')),
  template            TEXT        NOT NULL,
  payload             JSONB       NOT NULL DEFAULT '{}'::jsonb,
  status              TEXT        NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'sent', 'failed')),
  error_message       TEXT,
  sent_at             TIMESTAMPTZ,
  retries             INTEGER     NOT NULL DEFAULT 0 CHECK (retries >= 0),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_recipient_idx
  ON notifications (recipient_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_status_idx
  ON notifications (status, created_at)
  WHERE status IN ('pending', 'failed');

DROP TRIGGER IF EXISTS notifications_set_updated_at ON notifications;
CREATE TRIGGER notifications_set_updated_at
  BEFORE UPDATE ON notifications
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
