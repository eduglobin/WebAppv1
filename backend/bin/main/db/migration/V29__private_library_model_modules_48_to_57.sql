-- V29__private_library_model_modules_48_to_57.sql
-- Schema extensions for Private Library Model (Modules 48 - 67)

-- Module 48 & 55: Libraries WhatsApp & Book Catalog extensions
ALTER TABLE libraries 
    ADD COLUMN IF NOT EXISTS whatsapp_business_number VARCHAR(20),
    ADD COLUMN IF NOT EXISTS whatsapp_connected BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS whatsapp_verified BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS whatsapp_verified_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS has_book_catalog BOOLEAN DEFAULT FALSE;

-- Module 49 & 50: Seat Desk Two Pools & Reserved Status extensions
ALTER TABLE seat_desks 
    ADD COLUMN IF NOT EXISTS allocation_type VARCHAR(20) DEFAULT 'NON_RESERVED',
    ADD COLUMN IF NOT EXISTS reserved_status VARCHAR(20),
    ADD COLUMN IF NOT EXISTS grace_period_ends_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS temp_walkin_booking_id UUID;

-- Ensure check constraints on seat_desks if not exists
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_seat_desks_allocation_type') THEN
        ALTER TABLE seat_desks ADD CONSTRAINT chk_seat_desks_allocation_type CHECK (allocation_type IN ('RESERVED', 'NON_RESERVED'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_seat_desks_reserved_status') THEN
        ALTER TABLE seat_desks ADD CONSTRAINT chk_seat_desks_reserved_status CHECK (reserved_status IN ('ACTIVE', 'GRACE', 'VACATED') OR reserved_status IS NULL);
    END IF;
END $$;

-- Module 50 & 51: Monthly Seat Enrollments Table
CREATE TABLE IF NOT EXISTS monthly_seat_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    seat_id UUID NOT NULL REFERENCES seat_desks(id) ON DELETE CASCADE,
    student_library_profile_id UUID REFERENCES student_library_profiles(id) ON DELETE SET NULL,
    student_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    monthly_fee NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    current_period_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'GRACE', 'LAPSED', 'CANCELLED')),
    assigned_by VARCHAR(20) CHECK (assigned_by IN ('STUDENT_CHOICE', 'OWNER_ASSIGNED')),
    grace_days_configured INT DEFAULT 3,
    qr_payload TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Module 54 & 67: Accountless Visitor Passes Table
CREATE TABLE IF NOT EXISTS visitor_temp_passes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    phone_number VARCHAR(20) NOT NULL,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(150),
    whatsapp_number VARCHAR(20),
    seat_id UUID REFERENCES seat_desks(id) ON DELETE SET NULL,
    valid_from TIMESTAMP WITH TIME ZONE NOT NULL,
    valid_until TIMESTAMP WITH TIME ZONE NOT NULL,
    marketing_opt_out BOOLEAN DEFAULT FALSE,
    created_by_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    removed_by_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    removed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Module 56 & 64: Reserved Seat Attendance Log Table
CREATE TABLE IF NOT EXISTS reserved_seat_attendance_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seat_id UUID NOT NULL REFERENCES seat_desks(id) ON DELETE CASCADE,
    enrollment_id UUID REFERENCES monthly_seat_enrollments(id) ON DELETE CASCADE,
    marked_by_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    checked_in_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    checked_out_at TIMESTAMP WITH TIME ZONE
);

-- Module 61: WhatsApp Message Templates Table
CREATE TABLE IF NOT EXISTS whatsapp_message_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    template_type VARCHAR(30) NOT NULL CHECK (template_type IN ('BOOKING_CONFIRM', 'RENEWAL_REMINDER', 'PROMOTIONAL')),
    message_body TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
