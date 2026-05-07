-- 0003_uploads_category: optional category label on patient documents.
-- Free-form text so admins can introduce new categories without a
-- migration; the mobile app constrains the choice on the upload form
-- to a small set ("lab_report", "prescription", "imaging",
-- "insurance", "other") that we render with friendly labels.
--
-- NULL = legacy uploads that pre-dated this column. The list endpoint
-- returns them with category=null and the UI shows them as "Other".

ALTER TABLE uploads ADD COLUMN IF NOT EXISTS category TEXT;
