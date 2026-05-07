-- 0003_notes: clinical notes captured during/after the consultation.
-- Free-text, doctor-or-admin-writable. NULL until the doctor adds
-- something. Storing on the appointment row keeps the schema flat for
-- now; if note history matters later, split into appointment_notes.

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS notes TEXT;
