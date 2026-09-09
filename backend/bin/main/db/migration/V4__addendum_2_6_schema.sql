-- ─────────────────────────────────────────────────────────────────────────────
-- EduGlobin V4 — PRD Addendum v2.6 Schema
-- Modules 13, 14, 16, 17, 18, 19, 20
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Module 13: Free Libraries ────────────────────────────────────────────────
ALTER TABLE libraries ADD COLUMN is_free BOOLEAN DEFAULT FALSE;

-- Extend payment_mode to include FREE (drop & recreate constraint)
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_payment_mode_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_payment_mode_check
    CHECK (payment_mode IN ('ONLINE_GATEWAY', 'CASH', 'UPI_QR', 'FREE'));

-- ── Module 14: Simplified Seat Creation ─────────────────────────────────────
ALTER TABLE seat_desks ADD COLUMN layout_source VARCHAR(20) DEFAULT 'SIMPLE_COUNT'
    CHECK (layout_source IN ('SIMPLE_COUNT', 'PARAMETRIC', 'VISION_EXTRACTED'));

-- ── Module 16: Customer Support / Staff Escalation Channel ──────────────────
ALTER TABLE complaint_tickets ADD COLUMN scope VARCHAR(20) DEFAULT 'LIBRARY_SPECIFIC'
    CHECK (scope IN ('LIBRARY_SPECIFIC', 'PLATFORM_SUPPORT'));
-- PLATFORM_SUPPORT tickets don't require a specific library
ALTER TABLE complaint_tickets ALTER COLUMN library_id DROP NOT NULL;

-- ── Module 17: Price-Change Governance ──────────────────────────────────────
ALTER TABLE shifts ADD COLUMN pending_monthly_price NUMERIC(10,2);
ALTER TABLE shifts ADD COLUMN pending_daily_price   NUMERIC(10,2);
ALTER TABLE shifts ADD COLUMN price_change_status VARCHAR(20) DEFAULT 'NONE'
    CHECK (price_change_status IN ('NONE', 'PENDING_ADMIN_APPROVAL', 'APPROVED', 'REJECTED'));

-- Platform-wide configurable key-value store (not hardcoded in source)
CREATE TABLE IF NOT EXISTS platform_config (
    key         VARCHAR(60) PRIMARY KEY,
    value       VARCHAR(255) NOT NULL,
    description TEXT,
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO platform_config (key, value, description)
VALUES (
    'price_change_approval_threshold_pct',
    '20',
    'Price increase % above which Admin approval is required before going live'
) ON CONFLICT (key) DO NOTHING;

-- ── Module 18: Temporary Ticket & Owner Confirmation Window ─────────────────
ALTER TABLE bookings ADD COLUMN owner_confirmation_status VARCHAR(20) DEFAULT 'PENDING'
    CHECK (owner_confirmation_status IN ('PENDING', 'CONFIRMED', 'AUTO_CONFIRMED', 'OWNER_REJECTED'));
ALTER TABLE bookings ADD COLUMN owner_confirmation_deadline TIMESTAMP WITH TIME ZONE;

-- ── Module 19: Cancellation, Dispute & Fraud Resolution ─────────────────────

-- Tiered refund policy table (configurable, not hardcoded)
CREATE TABLE cancellation_refund_tiers (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hours_before_start_min INT  NOT NULL,
    hours_before_start_max INT,               -- NULL = "this value or more"
    refund_percentage     INT  NOT NULL CHECK (refund_percentage BETWEEN 0 AND 100)
);

-- Seed initial refund policy (confirm/tune without schema changes)
INSERT INTO cancellation_refund_tiers (hours_before_start_min, hours_before_start_max, refund_percentage)
VALUES
    (48, NULL, 100),   -- ≥ 48h before start → full refund
    (24, 48,   75),    -- 24–48h before start → 75%
    (6,  24,   50),    -- 6–24h before start  → 50%
    (0,  6,    0);     -- < 6h before start   → no refund

-- Booking cancellation audit columns
ALTER TABLE bookings ADD COLUMN cancelled_by_id              UUID REFERENCES profiles(id);
ALTER TABLE bookings ADD COLUMN cancelled_by_role            VARCHAR(20);
ALTER TABLE bookings ADD COLUMN cancellation_reason          TEXT;
ALTER TABLE bookings ADD COLUMN cancellation_initiated_at    TIMESTAMP WITH TIME ZONE;
ALTER TABLE bookings ADD COLUMN identity_confirmed           BOOLEAN DEFAULT FALSE;

-- Dispute tracking table
CREATE TABLE booking_disputes (
    id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id                 UUID NOT NULL REFERENCES bookings(id),
    raised_by_id               UUID NOT NULL REFERENCES profiles(id),
    dispute_reason             TEXT,
    server_recorded_actor_id   UUID NOT NULL REFERENCES profiles(id),
    server_recorded_actor_role VARCHAR(20) NOT NULL,
    resolution_status          VARCHAR(20) DEFAULT 'AUTO_REJECTED'
        CHECK (resolution_status IN ('AUTO_REJECTED', 'ESCALATED', 'RESOLVED_REFUND', 'RESOLVED_NO_REFUND')),
    escalated_to_staff_id      UUID REFERENCES profiles(id),
    escalated_to_admin         BOOLEAN DEFAULT FALSE,
    resolution_notes           TEXT,
    created_at                 TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at                TIMESTAMP WITH TIME ZONE
);

-- Student wallet — real financial liability, separate from gamification ledger
CREATE TABLE student_wallets (
    student_id UUID PRIMARY KEY REFERENCES profiles(id),
    balance    NUMERIC(10,2) NOT NULL DEFAULT 0,   -- negative = fine owed
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE wallet_transactions (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id           UUID           NOT NULL REFERENCES profiles(id),
    delta                NUMERIC(10,2)  NOT NULL,
    reason               VARCHAR(60)    NOT NULL
        CHECK (reason IN ('CANCELLATION_FINE','REFUND_CREDIT','FINE_SETTLED_AT_BOOKING','ADMIN_ADJUSTMENT')),
    reference_booking_id UUID REFERENCES bookings(id),
    created_at           TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_wallet_tx_student ON wallet_transactions (student_id, created_at);
CREATE INDEX idx_disputes_booking  ON booking_disputes (booking_id);
CREATE INDEX idx_disputes_status   ON booking_disputes (resolution_status) WHERE resolution_status = 'ESCALATED';
