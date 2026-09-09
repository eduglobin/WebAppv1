-- EduGlobin V20 — Complaints, Resolution Rating & Community Forum Schema

-- 1. Extend complaint_tickets with rating & feedback
ALTER TABLE complaint_tickets ADD COLUMN IF NOT EXISTS rating INT CHECK (rating BETWEEN 1 AND 5);
ALTER TABLE complaint_tickets ADD COLUMN IF NOT EXISTS rating_feedback TEXT;
ALTER TABLE complaint_tickets ADD COLUMN IF NOT EXISTS rated_at TIMESTAMP WITH TIME ZONE;

-- 2. Community Threads
CREATE TABLE IF NOT EXISTS community_threads (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id     UUID NOT NULL REFERENCES profiles(id),
    title         VARCHAR(255) NOT NULL,
    content       TEXT NOT NULL,
    exam_category VARCHAR(100),
    tags          TEXT[] DEFAULT '{}',
    upvotes       INT DEFAULT 0,
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_community_threads_exam ON community_threads(exam_category);
CREATE INDEX IF NOT EXISTS idx_community_threads_created ON community_threads(created_at DESC);

-- 3. Community Replies
CREATE TABLE IF NOT EXISTS community_replies (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id  UUID NOT NULL REFERENCES community_threads(id) ON DELETE CASCADE,
    author_id  UUID NOT NULL REFERENCES profiles(id),
    content    TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_community_replies_thread ON community_replies(thread_id, created_at ASC);
