-- V11: Add custom seat types and shift-specific seat type pricing

ALTER TABLE seat_desks
    ADD COLUMN IF NOT EXISTS seat_type VARCHAR(50) DEFAULT 'DESK',
    ADD COLUMN IF NOT EXISTS custom_type_name VARCHAR(100),
    ADD COLUMN IF NOT EXISTS custom_type_icon VARCHAR(20);

ALTER TABLE shifts
    ADD COLUMN IF NOT EXISTS seat_type_prices TEXT DEFAULT '{}';

ALTER TABLE libraries
    ADD COLUMN IF NOT EXISTS custom_seat_types TEXT DEFAULT '[]';

COMMENT ON COLUMN seat_desks.seat_type IS 'Category of seat: DESK, SOFA, RECLINER, WINDOW, CABIN, etc.';
COMMENT ON COLUMN shifts.seat_type_prices IS 'JSON map of seat types to prices under this shift timing';
COMMENT ON COLUMN libraries.custom_seat_types IS 'JSON array of owner-defined custom seat types';
