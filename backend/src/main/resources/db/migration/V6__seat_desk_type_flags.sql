-- V6: Add is_sofa and is_free flags to seat_desks for per-seat type classification

ALTER TABLE seat_desks
    ADD COLUMN IF NOT EXISTS is_sofa BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS is_free BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN seat_desks.is_sofa IS 'TRUE if this seat is a sofa/recliner/lounge-type seat (premium tier)';
COMMENT ON COLUMN seat_desks.is_free IS 'TRUE if this particular seat is offered free-of-charge regardless of library pricing';
