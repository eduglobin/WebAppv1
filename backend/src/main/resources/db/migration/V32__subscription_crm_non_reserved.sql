-- Subscription Categories
CREATE TABLE subscription_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    price NUMERIC(10,2) NOT NULL,
    features JSONB
);

ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES subscription_categories(id);

-- Library extensions for non-reserved monthly passes
ALTER TABLE libraries ADD COLUMN IF NOT EXISTS offers_non_reserved_daily BOOLEAN DEFAULT TRUE;
ALTER TABLE libraries ADD COLUMN IF NOT EXISTS offers_non_reserved_monthly BOOLEAN DEFAULT FALSE;
ALTER TABLE libraries ADD COLUMN IF NOT EXISTS non_reserved_monthly_duration_cap_minutes INT DEFAULT 360;

-- Non-reserved monthly passes table
CREATE TABLE IF NOT EXISTS non_reserved_monthly_passes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id UUID NOT NULL REFERENCES libraries(id),
    student_library_profile_id UUID NOT NULL REFERENCES student_library_profiles(id),
    monthly_fee NUMERIC(10,2) NOT NULL,
    daily_duration_cap_minutes INT NOT NULL,
    current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'GRACE', 'LAPSED', 'CANCELLED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
