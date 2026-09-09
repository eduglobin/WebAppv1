-- ─────────────────────────────────────────────────────────────────────────────
-- EduGlobin V19 — Feature Gap Closure: Girls-Only Gender, Initial Booking Cap
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Student Library Profile Gender Column for Girls-Only Seat Verification
ALTER TABLE student_library_profiles ADD COLUMN IF NOT EXISTS gender VARCHAR(10)
    CHECK (gender IN ('MALE', 'FEMALE', 'OTHER'));

-- 2. Library Initial Booking Duration Ceiling (Default 300 minutes = 5 hours)
ALTER TABLE libraries ADD COLUMN IF NOT EXISTS initial_booking_cap_minutes INT DEFAULT 300;

-- 3. Unified Desk Search Index for lightning fast student lookups
CREATE INDEX IF NOT EXISTS idx_student_lib_profiles_desk_search
    ON student_library_profiles (library_id, institute_id_number, institute_email);
