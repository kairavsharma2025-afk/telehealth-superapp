-- 0003_read_at: mark a notification as read by the recipient.
-- Nullable timestamp — NULL means unread. Indexed (recipient + read_at)
-- for the common "show me my unread count" lookup.

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS notifications_unread_idx
  ON notifications (recipient_user_id, created_at DESC)
  WHERE read_at IS NULL;
