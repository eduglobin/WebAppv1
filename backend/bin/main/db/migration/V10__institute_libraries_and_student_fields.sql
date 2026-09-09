-- ─────────────────────────────────────────────────────────────────────────────
-- EduGlobin V10 — Institute / Government / Private Library Category & College Student Verification Fields
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE libraries ADD COLUMN IF NOT EXISTS library_category VARCHAR(50) DEFAULT 'PRIVATE';
ALTER TABLE libraries ADD COLUMN IF NOT EXISTS allowed_email_domain VARCHAR(255);

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS college_id_number VARCHAR(100);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS college_email VARCHAR(255);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS student_age INT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS degree_program VARCHAR(100);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS branch_department VARCHAR(100);
