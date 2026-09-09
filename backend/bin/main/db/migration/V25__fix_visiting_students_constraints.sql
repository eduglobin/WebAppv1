-- Migration V25: Fix visiting circulation students constraints and support student-initiated visitor passes

-- 1. Relax purpose check constraint
ALTER TABLE visiting_circulation_students DROP CONSTRAINT IF EXISTS visiting_circulation_students_purpose_check;
ALTER TABLE visiting_circulation_students ADD CONSTRAINT visiting_circulation_students_purpose_check 
    CHECK (purpose IN ('ISSUE', 'REISSUE', 'RETURN', 'CIRCULATION', 'ENQUIRY_INSPECTION', 'DOCUMENT_SUBMISSION', 'GENERAL_VISIT', 'VISIT', 'ENQUIRY', 'OTHER'));

-- 2. Relax status check constraint to include PENDING_APPROVAL and CANCELLED
ALTER TABLE visiting_circulation_students DROP CONSTRAINT IF EXISTS visiting_circulation_students_status_check;
ALTER TABLE visiting_circulation_students ADD CONSTRAINT visiting_circulation_students_status_check 
    CHECK (status IN ('PENDING_APPROVAL', 'ACTIVE', 'EXIT_REQUESTED', 'COMPLETED', 'REJECTED', 'CANCELLED'));

-- 3. Ensure student_library_profiles has sensible defaults
ALTER TABLE student_library_profiles ALTER COLUMN library_category DROP NOT NULL;
ALTER TABLE student_library_profiles ADD COLUMN IF NOT EXISTS full_name VARCHAR(150);
ALTER TABLE student_library_profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE student_library_profiles ADD COLUMN IF NOT EXISTS is_claimed BOOLEAN DEFAULT TRUE;
