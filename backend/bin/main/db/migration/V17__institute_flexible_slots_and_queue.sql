-- ─────────────────────────────────────────────────────────────────────────────
-- EduGlobin V17 — Institute Flexible Slots, Operating Hours & Seat Queue Schema
-- ─────────────────────────────────────────────────────────────────────────────

-- Module 27: Add flexible slot rule configuration columns to libraries
ALTER TABLE libraries ADD COLUMN IF NOT EXISTS min_booking_minutes INT DEFAULT 30;
ALTER TABLE libraries ADD COLUMN IF NOT EXISTS max_booking_minutes INT DEFAULT 240;
ALTER TABLE libraries ADD COLUMN IF NOT EXISTS max_daily_minutes_per_student INT DEFAULT 360;
ALTER TABLE libraries ADD COLUMN IF NOT EXISTS advance_booking_max_minutes INT DEFAULT 120;
ALTER TABLE libraries ADD COLUMN IF NOT EXISTS turnover_buffer_minutes INT DEFAULT 5;
ALTER TABLE libraries ADD COLUMN IF NOT EXISTS operating_hours_start TIME DEFAULT '08:00';
ALTER TABLE libraries ADD COLUMN IF NOT EXISTS operating_hours_end TIME DEFAULT '20:00';

-- Module 29: Seat Queue table for Institute high-turnover libraries
CREATE TABLE IF NOT EXISTS seat_queue_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    seat_preference VARCHAR(20) DEFAULT 'ANY',
    requested_duration_minutes INT NOT NULL DEFAULT 60,
    status VARCHAR(20) DEFAULT 'WAITING'
        CHECK (status IN ('WAITING', 'OFFERED', 'CLAIMED', 'EXPIRED', 'CANCELLED')),
    offered_seat_id UUID REFERENCES seat_desks(id) ON DELETE SET NULL,
    offer_expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_queue_fifo ON seat_queue_entries (library_id, status, created_at);
