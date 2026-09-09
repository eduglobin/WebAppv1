-- Module 9: Library Onboarding & Approval
ALTER TABLE libraries ADD COLUMN onboarding_source VARCHAR(20) DEFAULT 'OWNER_INITIATED'
    CHECK (onboarding_source IN ('OWNER_INITIATED', 'ADMIN_INITIATED'));
ALTER TABLE libraries ADD COLUMN approval_status VARCHAR(20) DEFAULT 'PENDING_APPROVAL'
    CHECK (approval_status IN ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED'));
ALTER TABLE libraries ADD COLUMN rejection_reason TEXT;
ALTER TABLE libraries ADD COLUMN approved_by UUID REFERENCES profiles(id);
ALTER TABLE libraries ADD COLUMN approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE libraries ADD COLUMN kyc_document VARCHAR(255);

-- Module 10: Locker Ecosystem Configuration
ALTER TABLE libraries ADD COLUMN locker_mode VARCHAR(20) DEFAULT 'NO_LOCKERS'
    CHECK (locker_mode IN ('NO_LOCKERS', 'FREE_LOCKERS', 'PAID_MANAGED'));

-- Modify Lockers table to store tiered pricing by seat pass type
ALTER TABLE lockers DROP COLUMN price;
ALTER TABLE lockers DROP COLUMN duration_type;
ALTER TABLE lockers ADD COLUMN price_hourly NUMERIC(10,2);
ALTER TABLE lockers ADD COLUMN price_daily NUMERIC(10,2);
ALTER TABLE lockers ADD COLUMN price_weekly NUMERIC(10,2);
ALTER TABLE lockers ADD COLUMN price_monthly NUMERIC(10,2);

-- Modify Bookings table
ALTER TABLE bookings ADD COLUMN pass_type VARCHAR(20) NOT NULL DEFAULT 'DAILY'
    CHECK (pass_type IN ('HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY'));
ALTER TABLE bookings ADD COLUMN booking_source VARCHAR(20) DEFAULT 'ONLINE'
    CHECK (booking_source IN ('ONLINE', 'WALK_IN'));
ALTER TABLE bookings ADD COLUMN payment_mode VARCHAR(20) DEFAULT 'ONLINE_GATEWAY'
    CHECK (payment_mode IN ('ONLINE_GATEWAY', 'CASH', 'UPI_QR'));
ALTER TABLE bookings ADD COLUMN confirmed_by_id UUID REFERENCES profiles(id);

-- Modify Check-In logs
ALTER TABLE checkin_scan_logs ADD COLUMN confirmation_method VARCHAR(20) DEFAULT 'QR_SCAN'
    CHECK (confirmation_method IN ('QR_SCAN', 'MANUAL_ID'));

-- Module 11: Create Session Top-Up table
CREATE TABLE session_topups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id),
    additional_amount NUMERIC(10,2) NOT NULL,
    payment_mode VARCHAR(20) NOT NULL CHECK (payment_mode IN ('CASH', 'UPI_QR')),
    confirmed_by_id UUID NOT NULL REFERENCES profiles(id),
    extended_until TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
