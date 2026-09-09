-- ─────────────────────────────────────────────────────────────────────────────
-- EduGlobin V5 — Enhanced Onboarding Schema
-- Email, Discussion Room, Amenities, Books, Dual Base Pricing, Layout & Proof
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE libraries ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE libraries ADD COLUMN IF NOT EXISTS has_discussion_room BOOLEAN DEFAULT FALSE;
ALTER TABLE libraries ADD COLUMN IF NOT EXISTS discussion_room_capacity INT DEFAULT 0;

ALTER TABLE libraries ADD COLUMN IF NOT EXISTS wifi_available BOOLEAN DEFAULT TRUE;
ALTER TABLE libraries ADD COLUMN IF NOT EXISTS cctv_available BOOLEAN DEFAULT TRUE;
ALTER TABLE libraries ADD COLUMN IF NOT EXISTS power_backup_available BOOLEAN DEFAULT TRUE;
ALTER TABLE libraries ADD COLUMN IF NOT EXISTS water_dispenser_available BOOLEAN DEFAULT TRUE;
ALTER TABLE libraries ADD COLUMN IF NOT EXISTS newspaper_available BOOLEAN DEFAULT TRUE;

ALTER TABLE libraries ADD COLUMN IF NOT EXISTS books_capacity INT DEFAULT 0;
ALTER TABLE libraries ADD COLUMN IF NOT EXISTS available_books_data TEXT;

ALTER TABLE libraries ADD COLUMN IF NOT EXISTS base_desk_price_daily NUMERIC(10,2) DEFAULT 300.00;
ALTER TABLE libraries ADD COLUMN IF NOT EXISTS base_desk_price_monthly NUMERIC(10,2) DEFAULT 800.00;
ALTER TABLE libraries ADD COLUMN IF NOT EXISTS sofa_price_daily NUMERIC(10,2);
ALTER TABLE libraries ADD COLUMN IF NOT EXISTS sofa_price_monthly NUMERIC(10,2);

ALTER TABLE libraries ADD COLUMN IF NOT EXISTS layout_type VARCHAR(50) DEFAULT 'GENERATED_CLASSROOM';
ALTER TABLE libraries ADD COLUMN IF NOT EXISTS layout_file_url TEXT;

ALTER TABLE libraries ADD COLUMN IF NOT EXISTS proof_doc_type VARCHAR(100);
ALTER TABLE libraries ADD COLUMN IF NOT EXISTS proof_doc_number VARCHAR(100);
ALTER TABLE libraries ADD COLUMN IF NOT EXISTS proof_doc_url TEXT;
