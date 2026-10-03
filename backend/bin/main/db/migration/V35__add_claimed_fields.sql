ALTER TABLE student_library_profiles ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE owner_pre_registered_students ADD COLUMN IF NOT EXISTS is_claimed BOOLEAN DEFAULT FALSE;
ALTER TABLE owner_pre_registered_students ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMP WITH TIME ZONE;
