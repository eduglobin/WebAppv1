-- Migration V33: Relax check constraints on bookings table for payment_mode, pass_type, booking_source, and owner_confirmation_status

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_payment_mode_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_payment_mode_check
    CHECK (payment_mode IN ('ONLINE_GATEWAY', 'ONLINE', 'CASH', 'UPI_QR', 'FREE', 'WALLET', 'DIRECT_BOOKING', 'RAZORPAY', 'STRIPE', 'PAYTM') OR payment_mode IS NULL);

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_pass_type_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_pass_type_check
    CHECK (pass_type IN ('HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM', 'FIXED_SHIFT', 'FULL_DAY', 'HALF_DAY') OR pass_type IS NULL);

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_booking_source_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_booking_source_check
    CHECK (booking_source IN ('ONLINE', 'WALK_IN', 'STUDENT_APP', 'DIRECT', 'DIRECT_BOOKING', 'DESK_COUNTER') OR booking_source IS NULL);

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_owner_confirmation_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_owner_confirmation_status_check
    CHECK (owner_confirmation_status IN ('PENDING', 'CONFIRMED', 'AUTO_CONFIRMED', 'OWNER_REJECTED', 'APPROVED', 'AUTO_APPROVED') OR owner_confirmation_status IS NULL);

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_status_check
    CHECK (status IN ('LOCKED', 'BOOKED', 'IN_USE', 'CANCELLED', 'EXPIRED', 'COMPLETED', 'ACTIVE') OR status IS NULL);
