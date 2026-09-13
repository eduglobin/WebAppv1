-- Migration V31: Extend Locker Charges to Monthly Enrollment (Module 51) and Visitor Temp Passes (Module 54/67)

ALTER TABLE monthly_seat_enrollments ADD COLUMN IF NOT EXISTS has_locker BOOLEAN DEFAULT FALSE;
ALTER TABLE monthly_seat_enrollments ADD COLUMN IF NOT EXISTS locker_id UUID REFERENCES lockers(id);
ALTER TABLE monthly_seat_enrollments ADD COLUMN IF NOT EXISTS monthly_locker_fee NUMERIC(10,2) DEFAULT 0.00;

ALTER TABLE visitor_temp_passes ADD COLUMN IF NOT EXISTS has_locker BOOLEAN DEFAULT FALSE;
ALTER TABLE visitor_temp_passes ADD COLUMN IF NOT EXISTS locker_id UUID REFERENCES lockers(id);
ALTER TABLE visitor_temp_passes ADD COLUMN IF NOT EXISTS locker_fee NUMERIC(10,2) DEFAULT 0.00;
