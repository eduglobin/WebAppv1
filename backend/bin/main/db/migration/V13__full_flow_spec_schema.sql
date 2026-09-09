-- Migration V13: Full System Flow Specification Schema
-- Adds support for:
-- 1. Resubmission tracking on libraries
-- 2. Post-approval category-specific library checklist
-- 3. Per-library student profiles (IRCTC-style identity)
-- 4. Owner cancellation confirmation requests

-- 1. Library Onboarding & Category Checklist Extensions
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE libraries ADD COLUMN IF NOT EXISTS resubmission_count INT DEFAULT 0;
ALTER TABLE libraries ADD COLUMN IF NOT EXISTS institute_id_format_regex VARCHAR(100);
ALTER TABLE libraries ADD COLUMN IF NOT EXISTS institute_branches TEXT[];
ALTER TABLE libraries ADD COLUMN IF NOT EXISTS institute_years TEXT[];
ALTER TABLE libraries ADD COLUMN IF NOT EXISTS accepted_govt_id_types TEXT[];

-- 2. Per-Library Student Profiles (IRCTC Saved Passenger Identity Model)
CREATE TABLE IF NOT EXISTS student_library_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    library_id UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    library_category VARCHAR(20) NOT NULL,

    -- Institute specific identity
    institute_email VARCHAR(150),
    institute_id_number VARCHAR(50),
    branch VARCHAR(100),
    year VARCHAR(20),
    institute_email_verified BOOLEAN DEFAULT FALSE,

    -- Government specific identity
    govt_id_type VARCHAR(30),
    govt_id_last4 VARCHAR(4),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_student_library_profile UNIQUE (student_id, library_id)
);

CREATE INDEX IF NOT EXISTS idx_student_library_profiles_lookup ON student_library_profiles (library_id, institute_id_number);
CREATE INDEX IF NOT EXISTS idx_student_library_profiles_email ON student_library_profiles (library_id, institute_email);

-- 3. Owner Cancellation Requests (Student Confirmation Gate for Booked/Not-In-Use Seats)
CREATE TABLE IF NOT EXISTS owner_cancellation_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    requested_by_id UUID NOT NULL REFERENCES profiles(id),
    status VARCHAR(30) DEFAULT 'PENDING_STUDENT_CONFIRMATION'
        CHECK (status IN ('PENDING_STUDENT_CONFIRMATION', 'CONFIRMED', 'DECLINED', 'TIMED_OUT')),
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE
);
