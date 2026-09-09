-- Migration V26: Owner-Configurable Identity Requirements & Extended Student Profile Schema

-- 1. Create library_identity_field_config table
CREATE TABLE IF NOT EXISTS library_identity_field_config (
    library_id UUID PRIMARY KEY REFERENCES libraries(id) ON DELETE CASCADE,
    fast_path_zero_fields BOOLEAN DEFAULT TRUE,
    require_phone_verified BOOLEAN DEFAULT TRUE,
    require_aadhaar_last4 BOOLEAN DEFAULT FALSE,
    require_pan_masked BOOLEAN DEFAULT FALSE,
    require_target_exam BOOLEAN DEFAULT FALSE,
    require_college_name BOOLEAN DEFAULT FALSE,
    custom_fields JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_identity_config_lib ON library_identity_field_config(library_id);

-- 2. Extend student_library_profiles for configurable KYC & phone identity
ALTER TABLE student_library_profiles ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20);
ALTER TABLE student_library_profiles ADD COLUMN IF NOT EXISTS masked_aadhaar VARCHAR(12);
ALTER TABLE student_library_profiles ADD COLUMN IF NOT EXISTS aadhaar_hash VARCHAR(64);
ALTER TABLE student_library_profiles ADD COLUMN IF NOT EXISTS masked_pan VARCHAR(10);
ALTER TABLE student_library_profiles ADD COLUMN IF NOT EXISTS target_exam VARCHAR(100);
ALTER TABLE student_library_profiles ADD COLUMN IF NOT EXISTS custom_identity_fields JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_student_library_profiles_phone ON student_library_profiles(library_id, phone_number);
CREATE INDEX IF NOT EXISTS idx_student_library_profiles_aadhaar_hash ON student_library_profiles(library_id, aadhaar_hash);
