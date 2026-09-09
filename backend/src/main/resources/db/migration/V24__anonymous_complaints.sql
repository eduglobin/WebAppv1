-- Add is_anonymous column to complaint_tickets
ALTER TABLE complaint_tickets ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT FALSE;
