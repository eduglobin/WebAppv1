-- ─────────────────────────────────────────────────────────────────────────────
-- EduGlobin V1 — Full Schema Migration (v2 spec)
-- Applies everything up-front so later days never hit a missing-table error.
-- ─────────────────────────────────────────────────────────────────────────────

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS postgis;

-- ─── Profiles ────────────────────────────────────────────────────────────────
-- Extends Supabase's auth.users; one row per auth user.
CREATE TABLE profiles (
    id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name           VARCHAR(150),
    role                VARCHAR(20) NOT NULL DEFAULT 'STUDENT'
                            CHECK (role IN ('STUDENT','LIBRARY_OWNER','STAFF','SUPER_ADMIN')),
    auth_provider       VARCHAR(20) NOT NULL DEFAULT 'EMAIL'
                            CHECK (auth_provider IN ('EMAIL', 'GOOGLE')),
    assigned_library_id UUID,                      -- STAFF only; FK added after libraries table
    account_status      VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
                            CHECK (account_status IN ('ACTIVE','PENDING_APPROVAL','SUSPENDED')),
    preferred_language  VARCHAR(5)  NOT NULL DEFAULT 'en'
                            CHECK (preferred_language IN ('en','hi')),
    preferred_theme     VARCHAR(10) NOT NULL DEFAULT 'SYSTEM'
                            CHECK (preferred_theme IN ('LIGHT','DARK','SYSTEM')),
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ─── Libraries ────────────────────────────────────────────────────────────────
CREATE TABLE libraries (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id                    UUID        NOT NULL REFERENCES profiles(id),
    name                        VARCHAR(255) NOT NULL,
    slug                        VARCHAR(255) UNIQUE NOT NULL,
    city                        VARCHAR(100) NOT NULL,
    locality                    VARCHAR(150) NOT NULL,
    state                       VARCHAR(100) NOT NULL,
    geo_point                   GEOGRAPHY(Point, 4326) NOT NULL,
    total_seats                 INT         NOT NULL CHECK (total_seats > 0),
    seating_type                VARCHAR(20) DEFAULT 'CHAIR'
                                    CHECK (seating_type IN ('CHAIR','SOFA','MIXED','ERGONOMIC')),
    ac_available                BOOLEAN     DEFAULT FALSE,
    girls_safety_score          INT         DEFAULT 85 CHECK (girls_safety_score BETWEEN 0 AND 100),
    has_girls_section           BOOLEAN     DEFAULT FALSE,
    cancellation_deadline_hours INT         DEFAULT 24,
    coins_balance               BIGINT      DEFAULT 1200,
    is_published                BOOLEAN     DEFAULT FALSE,
    created_at                  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at                  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Back-reference FK from profiles.assigned_library_id → libraries.id
ALTER TABLE profiles
    ADD CONSTRAINT fk_assigned_library
    FOREIGN KEY (assigned_library_id) REFERENCES libraries(id);

CREATE INDEX idx_libraries_geo          ON libraries USING GIST (geo_point);
CREATE INDEX idx_libraries_city_locality ON libraries (city, locality);

-- ─── Shifts ───────────────────────────────────────────────────────────────────
CREATE TABLE shifts (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id    UUID           NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    shift_name    VARCHAR(100)   NOT NULL,
    start_time    TIME           NOT NULL,
    end_time      TIME           NOT NULL,
    monthly_price NUMERIC(10, 2) NOT NULL,
    daily_price   NUMERIC(10, 2) NOT NULL,
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ─── Seat / Desks ─────────────────────────────────────────────────────────────
CREATE TABLE seat_desks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id      UUID        NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    seat_code       VARCHAR(50) NOT NULL,
    row_idx         INT         NOT NULL,
    col_idx         INT         NOT NULL,
    is_girls_only   BOOLEAN     DEFAULT FALSE,
    has_power_socket BOOLEAN    DEFAULT TRUE,
    dist_to_ac_m    NUMERIC(6, 2),
    dist_to_door_m  NUMERIC(6, 2),
    current_status  VARCHAR(20) DEFAULT 'AVAILABLE'
                        CHECK (current_status IN ('AVAILABLE','LOCKED','BOOKED','IN_USE','MAINTENANCE')),
    UNIQUE (library_id, seat_code),
    UNIQUE (library_id, row_idx, col_idx)
);

-- ─── Lockers ──────────────────────────────────────────────────────────────────
CREATE TABLE lockers (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id     UUID           NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    locker_code    VARCHAR(20)    NOT NULL,
    price          NUMERIC(10, 2) NOT NULL,
    duration_type  VARCHAR(20)    NOT NULL CHECK (duration_type IN ('DAILY','WEEKLY','MONTHLY')),
    current_status VARCHAR(20)    DEFAULT 'AVAILABLE'
                       CHECK (current_status IN ('AVAILABLE','LOCKED','BOOKED','IN_USE')),
    UNIQUE (library_id, locker_code)
);

-- ─── Bookings ─────────────────────────────────────────────────────────────────
CREATE TABLE bookings (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_reference   VARCHAR(50) UNIQUE NOT NULL,
    student_id          UUID           NOT NULL REFERENCES profiles(id),
    library_id          UUID           NOT NULL REFERENCES libraries(id),
    shift_id            UUID           NOT NULL REFERENCES shifts(id),
    seat_id             UUID           NOT NULL REFERENCES seat_desks(id),
    locker_id           UUID           REFERENCES lockers(id),
    amount_paid         NUMERIC(10, 2) NOT NULL,
    locker_fee          NUMERIC(10, 2) DEFAULT 0,
    qr_payload_hash     VARCHAR(255)   NOT NULL,
    valid_from          TIMESTAMP WITH TIME ZONE NOT NULL,
    valid_until         TIMESTAMP WITH TIME ZONE NOT NULL,
    status              VARCHAR(20)    DEFAULT 'BOOKED'
                            CHECK (status IN ('LOCKED','BOOKED','IN_USE','CANCELLED','EXPIRED','COMPLETED')),
    checked_in_at       TIMESTAMP WITH TIME ZONE,
    total_study_minutes INT            DEFAULT 0,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_bookings_student      ON bookings (student_id);
CREATE INDEX idx_bookings_active_shift ON bookings (library_id, shift_id, status);

-- ─── Student CRM Records ──────────────────────────────────────────────────────
CREATE TABLE student_crm_records (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id        UUID           NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    seat_id           UUID           NOT NULL REFERENCES seat_desks(id),
    student_name      VARCHAR(150)   NOT NULL,
    contact_number    VARCHAR(15)    NOT NULL,
    father_name       VARCHAR(150),
    permanent_address TEXT,
    masked_aadhaar    VARCHAR(20)    NOT NULL,
    aadhaar_hash      VARCHAR(255),              -- SHA-256 of raw Aadhaar; raw is NEVER stored
    aadhaar_verified  BOOLEAN        DEFAULT FALSE,
    monthly_fee       NUMERIC(10, 2) NOT NULL,
    admission_fee     NUMERIC(10, 2) DEFAULT 0,
    advance_paid      NUMERIC(10, 2) DEFAULT 0,
    pending_balance   NUMERIC(10, 2) DEFAULT 0,
    payment_status    VARCHAR(20)    DEFAULT 'PREPAID'
                          CHECK (payment_status IN ('PREPAID','POSTPAID','OVERDUE','UNPAID')),
    is_vacated        BOOLEAN        DEFAULT FALSE,
    vacated_at        TIMESTAMP WITH TIME ZONE,
    created_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ─── Complaint Tickets ────────────────────────────────────────────────────────
CREATE TABLE complaint_tickets (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_code            VARCHAR(30) UNIQUE NOT NULL,
    library_id             UUID        NOT NULL REFERENCES libraries(id),
    student_id             UUID        NOT NULL REFERENCES profiles(id),
    category               VARCHAR(50) NOT NULL,
    priority               VARCHAR(20) DEFAULT 'NORMAL' CHECK (priority IN ('NORMAL','HIGH','URGENT')),
    description            TEXT        NOT NULL,
    status                 VARCHAR(20) DEFAULT 'PENDING'
                               CHECK (status IN ('PENDING','UNDER_REVIEW','RESOLVED')),
    sla_deadline           TIMESTAMP WITH TIME ZONE NOT NULL,
    owner_resolution_notes TEXT,
    resolved_at            TIMESTAMP WITH TIME ZONE,
    created_at             TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ─── Check-in Scan Logs ───────────────────────────────────────────────────────
CREATE TABLE checkin_scan_logs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id    UUID        NOT NULL REFERENCES bookings(id),
    scanned_by_id UUID        NOT NULL REFERENCES profiles(id),  -- owner or staff
    scan_result   VARCHAR(30) NOT NULL
                      CHECK (scan_result IN ('SUCCESS','EXPIRED','ALREADY_USED','INVALID_SIGNATURE')),
    scanned_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ─── Audit Logs ───────────────────────────────────────────────────────────────
CREATE TABLE audit_logs (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id     UUID        NOT NULL REFERENCES profiles(id),
    actor_role   VARCHAR(20) NOT NULL,
    action       VARCHAR(60) NOT NULL,
    entity_type  VARCHAR(40) NOT NULL,
    entity_id    UUID        NOT NULL,
    before_value JSONB,
    after_value  JSONB,
    ip_address   VARCHAR(45),
    created_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_entity ON audit_logs (entity_type, entity_id);
CREATE INDEX idx_audit_actor  ON audit_logs (actor_id, created_at);

-- ─── Points / Coins Ledger ────────────────────────────────────────────────────
CREATE TABLE points_coins_ledger (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('STUDENT_POINTS','LIBRARY_COINS')),
    account_id   UUID        NOT NULL,
    delta        INT         NOT NULL,
    reason       VARCHAR(60) NOT NULL,
    reference_id UUID,
    created_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ─── India Admin Hierarchy ────────────────────────────────────────────────────
-- Seeded from LGD open data on Day 2; structure created now.
CREATE TABLE india_admin_hierarchy (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    village_or_area VARCHAR(150),
    tehsil          VARCHAR(150) NOT NULL,
    district        VARCHAR(150) NOT NULL,
    state           VARCHAR(100) NOT NULL,
    lat             DOUBLE PRECISION,
    lng             DOUBLE PRECISION,
    is_featured_hub BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_admin_search ON india_admin_hierarchy USING GIN (
    to_tsvector('simple',
        coalesce(village_or_area, '') || ' ' || tehsil || ' ' || district || ' ' || state
    )
);

-- ─── Auto-update libraries.updated_at on any row change ──────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_libraries_updated_at
    BEFORE UPDATE ON libraries
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
