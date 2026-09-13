-- V30__monthly_subscription_toggle_and_locker_modes.sql
-- Add monthly pass subscription mode toggle and configurable locker settings

ALTER TABLE libraries
  ADD COLUMN IF NOT EXISTS enable_monthly_pass_subscription BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS monthly_locker_mode VARCHAR(30) DEFAULT 'NO_LOCKERS',
  ADD COLUMN IF NOT EXISTS monthly_locker_price NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_locker_mode VARCHAR(30) DEFAULT 'NO_LOCKERS',
  ADD COLUMN IF NOT EXISTS daily_locker_price NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overnight_locker_charge NUMERIC(10,2) DEFAULT 0;
