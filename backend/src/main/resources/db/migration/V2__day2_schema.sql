-- Day 2: Schema Migration and Pilot Data Seeding

-- 1. Add new columns to libraries table for search and filtering
ALTER TABLE libraries ADD COLUMN IF NOT EXISTS amenities TEXT[] DEFAULT '{}';
ALTER TABLE libraries ADD COLUMN IF NOT EXISTS focused_exams TEXT[] DEFAULT '{}';
ALTER TABLE libraries ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE;
ALTER TABLE libraries ADD COLUMN IF NOT EXISTS rating NUMERIC(3,2) DEFAULT 4.0 CHECK (rating BETWEEN 0 AND 5);
ALTER TABLE libraries ADD COLUMN IF NOT EXISTS monthly_price NUMERIC(10,2) DEFAULT 800.00;

-- 2. Create GIN indexes for array-based columns to optimize filter performance
CREATE INDEX IF NOT EXISTS idx_libraries_amenities ON libraries USING GIN (amenities);
CREATE INDEX IF NOT EXISTS idx_libraries_exams ON libraries USING GIN (focused_exams);

-- 3. Seed pilot location data into india_admin_hierarchy for Indore and Kota
INSERT INTO india_admin_hierarchy (id, village_or_area, tehsil, district, state, lat, lng, is_featured_hub)
VALUES
  (gen_random_uuid(), 'Bhawarkua',      'Indore', 'Indore', 'Madhya Pradesh', 22.6892, 75.8636, TRUE),
  (gen_random_uuid(), 'Vijay Nagar',    'Indore', 'Indore', 'Madhya Pradesh', 22.7244, 75.8839, TRUE),
  (gen_random_uuid(), 'Palasia',        'Indore', 'Indore', 'Madhya Pradesh', 22.7213, 75.8728, TRUE),
  (gen_random_uuid(), 'MG Road',        'Indore', 'Indore', 'Madhya Pradesh', 22.7196, 75.8577, FALSE),
  (gen_random_uuid(), 'Rau',            'Mhow',   'Indore', 'Madhya Pradesh', 22.6323, 75.8047, FALSE),
  (gen_random_uuid(), 'Talwandi',       'Kota',   'Kota',   'Rajasthan',      25.1763, 75.8434, TRUE),
  (gen_random_uuid(), 'Vigyan Nagar',   'Kota',   'Kota',   'Rajasthan',      25.1682, 75.8513, TRUE),
  (gen_random_uuid(), 'Gumanpura',      'Kota',   'Kota',   'Rajasthan',      25.1828, 75.8392, FALSE),
  (gen_random_uuid(), 'Rangbari',       'Kota',   'Kota',   'Rajasthan',      25.1411, 75.8289, FALSE),
  (gen_random_uuid(), 'Dadi ka Phatak', 'Kota',   'Kota',   'Rajasthan',      25.1910, 75.8455, FALSE)
ON CONFLICT DO NOTHING;
