-- ─── Module 36: Visiting Circulation Students (Issue, Reissue, Return) ───────

CREATE TABLE visiting_circulation_students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    student_library_profile_id UUID NOT NULL REFERENCES student_library_profiles(id) ON DELETE CASCADE,
    purpose VARCHAR(30) NOT NULL DEFAULT 'CIRCULATION' CHECK (purpose IN ('ISSUE', 'REISSUE', 'RETURN', 'CIRCULATION')),
    check_in_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    check_out_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'EXIT_REQUESTED', 'COMPLETED', 'REJECTED')),
    exit_request_at TIMESTAMP WITH TIME ZONE,
    exit_approved_at TIMESTAMP WITH TIME ZONE,
    exit_approved_by_id UUID REFERENCES profiles(id),
    time_limit_minutes INT NOT NULL DEFAULT 40,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_visiting_circulation_active ON visiting_circulation_students (library_id, status)
    WHERE status IN ('ACTIVE', 'EXIT_REQUESTED');

CREATE INDEX idx_visiting_circulation_profile ON visiting_circulation_students (student_library_profile_id, status);
