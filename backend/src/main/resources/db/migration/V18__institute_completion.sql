-- ─────────────────────────────────────────────────────────────────────────────
-- EduGlobin V18 — Institute Completion: Item Log Entries & Vacate Integrity Hardening
-- ─────────────────────────────────────────────────────────────────────────────

-- Simple item issue/return log (no complex catalog, no due dates, no reissue cycles)
CREATE TABLE IF NOT EXISTS item_log_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    student_library_profile_id UUID NOT NULL REFERENCES student_library_profiles(id) ON DELETE CASCADE,
    item_name VARCHAR(150) NOT NULL,
    action VARCHAR(10) NOT NULL CHECK (action IN ('ISSUED', 'RETURNED')),
    verified_by_id UUID NOT NULL REFERENCES profiles(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_item_log_student ON item_log_entries (student_library_profile_id, created_at DESC);

-- Vacate / cancellation integrity hardening columns
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS vacate_token_generated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS vacate_token_expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE owner_cancellation_requests ADD COLUMN IF NOT EXISTS response_deadline TIMESTAMP WITH TIME ZONE;
