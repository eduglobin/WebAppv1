-- Reference Books
ALTER TABLE item_log_entries ADD COLUMN IF NOT EXISTS is_reference_only BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS reference_book_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    item_name VARCHAR(150) NOT NULL,
    student_library_profile_id UUID NOT NULL REFERENCES student_library_profiles(id) ON DELETE CASCADE,
    reserved_from TIMESTAMP WITH TIME ZONE NOT NULL,
    reserved_until TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) DEFAULT 'RESERVED' CHECK (status IN ('RESERVED', 'RETURNED', 'EXPIRED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
