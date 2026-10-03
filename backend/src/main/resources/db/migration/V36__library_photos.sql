-- V36: library_photos — store library images uploaded by owners or admin
CREATE TABLE IF NOT EXISTS library_photos (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id      UUID        NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    url             TEXT        NOT NULL,
    caption         TEXT,
    display_order   INT         NOT NULL DEFAULT 0,
    uploaded_by     UUID        REFERENCES profiles(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_library_photos_library_id
    ON library_photos (library_id, display_order);
