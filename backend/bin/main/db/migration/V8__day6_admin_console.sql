-- ─────────────────────────────────────────────────────────────────────────────
-- EduGlobin V8 — Day 6: Admin Console Schema Additions
-- Staff provisioning, library suspension, admin oversight
-- ─────────────────────────────────────────────────────────────────────────────

-- Staff forced password change on first login
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE;

-- Add SUSPENDED as a distinct approval status (vs REJECTED which means "never approved")
ALTER TABLE libraries DROP CONSTRAINT IF EXISTS libraries_approval_status_check;
ALTER TABLE libraries ADD CONSTRAINT libraries_approval_status_check
    CHECK (approval_status IN ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED', 'SUSPENDED'));

-- Add admin_resolution_notes to complaint_tickets for admin resolve
ALTER TABLE complaint_tickets ADD COLUMN IF NOT EXISTS admin_resolution_notes TEXT;
ALTER TABLE complaint_tickets ADD COLUMN IF NOT EXISTS resolved_by_id UUID REFERENCES profiles(id);

-- Indexes for admin queries
CREATE INDEX IF NOT EXISTS idx_libraries_approval_status ON libraries (approval_status);
CREATE INDEX IF NOT EXISTS idx_shifts_price_change_status ON shifts (price_change_status) WHERE price_change_status = 'PENDING_ADMIN_APPROVAL';
CREATE INDEX IF NOT EXISTS idx_complaint_scope_status ON complaint_tickets (scope, status) WHERE scope = 'PLATFORM_SUPPORT';
