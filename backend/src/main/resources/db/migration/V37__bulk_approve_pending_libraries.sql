-- ─────────────────────────────────────────────────────────────────────────────
-- EduGlobin V37 — Bulk approve all pending/changes-requested libraries
-- Approves every library in PENDING_APPROVAL or CHANGES_REQUESTED status,
-- sets is_published = TRUE and clears any rejection_reason.
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE libraries
SET
    approval_status  = 'APPROVED',
    is_published     = TRUE,
    rejection_reason = NULL,
    approved_at      = NOW()
WHERE approval_status IN ('PENDING_APPROVAL', 'CHANGES_REQUESTED');
