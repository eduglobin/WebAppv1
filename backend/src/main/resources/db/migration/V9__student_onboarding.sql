-- ─────────────────────────────────────────────────────────────────────────────
-- EduGlobin V9 — Student Onboarding Profile Fields
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS target_exam VARCHAR(100);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS city VARCHAR(100);
