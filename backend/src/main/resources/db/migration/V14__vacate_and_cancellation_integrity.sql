-- Migration V14: Institute Vacate & Cancellation Integrity Model (Modules 36-40)

-- 1. Add vacate audit and token TTL tracking columns to bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS vacated_by VARCHAR(50);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS vacate_token_generated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS vacate_token_expires_at TIMESTAMP WITH TIME ZONE;

-- 2. Add response deadline for owner cancellation requests (10-minute student protection timeout)
ALTER TABLE owner_cancellation_requests ADD COLUMN IF NOT EXISTS response_deadline TIMESTAMP WITH TIME ZONE;

-- 3. Create read-optimized, single immutable booking timeline view
CREATE OR REPLACE VIEW booking_timeline AS
SELECT
    al.id::text AS event_id,
    (al.entity_id)::uuid AS booking_id,
    'AUDIT' AS source,
    al.actor_role,
    al.action,
    al.created_at AS event_at,
    al.after_value::text AS detail
FROM audit_logs al
WHERE al.entity_type = 'BOOKINGS' OR al.entity_type = 'booking'

UNION ALL

SELECT
    csl.id::text AS event_id,
    csl.booking_id,
    'SCAN' AS source,
    'SYSTEM' AS actor_role,
    csl.scan_result AS action,
    csl.scanned_at AS event_at,
    jsonb_build_object('method', csl.confirmation_method)::text AS detail
FROM checkin_scan_logs csl

ORDER BY event_at ASC;
