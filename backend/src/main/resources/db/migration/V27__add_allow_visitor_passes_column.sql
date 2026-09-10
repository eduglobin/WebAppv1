-- ─────────────────────────────────────────────────────────────────────────────
-- EduGlobin V27 Migration — Add allow_visitor_passes to libraries table
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE libraries 
ADD COLUMN IF NOT EXISTS allow_visitor_passes BOOLEAN DEFAULT TRUE;
