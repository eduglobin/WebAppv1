-- ─── Module 32: Book Catalog & Loan Schema ──────────────────────────────────────

CREATE TABLE library_book_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    book_code VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    author VARCHAR(255),
    category VARCHAR(100),
    total_copies INT NOT NULL DEFAULT 1,
    available_copies INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (library_id, book_code)
);

CREATE TABLE book_loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id UUID NOT NULL REFERENCES libraries(id),
    book_id UUID NOT NULL REFERENCES library_book_catalog(id),
    student_library_profile_id UUID NOT NULL REFERENCES student_library_profiles(id),
    issued_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    due_at TIMESTAMP WITH TIME ZONE NOT NULL,
    reissue_count INT DEFAULT 0,
    returned_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'ISSUED' CHECK (status IN ('ISSUED', 'OVERDUE', 'RETURNED')),
    issued_by_id UUID NOT NULL REFERENCES profiles(id),
    returned_by_id UUID REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_book_loans_active ON book_loans (student_library_profile_id, status)
    WHERE status IN ('ISSUED', 'OVERDUE');

CREATE INDEX idx_book_catalog_lib ON library_book_catalog (library_id, title);

-- ─── Module 35: Student Library Profile Soft-Deactivation Columns ─────────────

ALTER TABLE student_library_profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE student_library_profiles ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE student_library_profiles ADD COLUMN IF NOT EXISTS deactivated_by_id UUID REFERENCES profiles(id);
ALTER TABLE student_library_profiles ADD COLUMN IF NOT EXISTS deactivation_reason TEXT;
