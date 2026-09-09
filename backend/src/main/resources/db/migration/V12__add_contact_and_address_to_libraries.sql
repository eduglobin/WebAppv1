-- Add contact_number and address columns to libraries table
ALTER TABLE libraries ADD COLUMN IF NOT EXISTS contact_number VARCHAR(30);
ALTER TABLE libraries ADD COLUMN IF NOT EXISTS address TEXT;
