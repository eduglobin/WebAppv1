-- ─────────────────────────────────────────────────────────────────────────────
-- EduGlobin V23 — Owner Pre-Registered Student Roster Table
-- Allows library owners to bulk-upload a student roster (ID, name, contact,
-- email, branch) so that walk-in seat assignment is restricted to only
-- students whose IDs are on this approved list.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS owner_pre_registered_students (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id  UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    id_number   VARCHAR(100) NOT NULL,
    student_name VARCHAR(200) NOT NULL,
    contact_number VARCHAR(20),
    email       VARCHAR(200),
    branch      VARCHAR(100),
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_owner_prereg_student UNIQUE (library_id, id_number)
);

CREATE INDEX IF NOT EXISTS idx_prereg_students_library
    ON owner_pre_registered_students (library_id, is_active);

CREATE INDEX IF NOT EXISTS idx_prereg_students_id_number
    ON owner_pre_registered_students (library_id, LOWER(id_number));

CREATE INDEX IF NOT EXISTS idx_prereg_students_contact
    ON owner_pre_registered_students (library_id, contact_number);
