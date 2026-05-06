-- 0001_appointments: bookings between a patient and a doctor.
-- Same Postgres instance, so FKs to users(id) are kept while we're early.
-- The EXCLUDE constraint is the load-bearing piece: it prevents two
-- still-active appointments (scheduled or confirmed) from overlapping
-- in time for the same doctor — declarative, race-free, no app logic.

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS appointments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id   UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  doctor_id    UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  start_at     TIMESTAMPTZ NOT NULL,
  end_at       TIMESTAMPTZ NOT NULL,
  status       TEXT        NOT NULL DEFAULT 'scheduled'
                 CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled')),
  reason       TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT end_after_start CHECK (end_at > start_at),
  CONSTRAINT patient_doctor_distinct CHECK (patient_id <> doctor_id)
);

CREATE INDEX IF NOT EXISTS appointments_doctor_idx  ON appointments (doctor_id, start_at);
CREATE INDEX IF NOT EXISTS appointments_patient_idx ON appointments (patient_id, start_at);

ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_no_doctor_overlap;
ALTER TABLE appointments
  ADD CONSTRAINT appointments_no_doctor_overlap
  EXCLUDE USING gist (
    doctor_id WITH =,
    tstzrange(start_at, end_at, '[)') WITH &&
  ) WHERE (status IN ('scheduled', 'confirmed'));

DROP TRIGGER IF EXISTS appointments_set_updated_at ON appointments;
CREATE TRIGGER appointments_set_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
