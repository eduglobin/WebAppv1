-- ─────────────────────────────────────────────────────────────────────────────
-- EduGlobin V28 — Seed 8 Dummy Libraries in Bhilai & Durg (Chhattisgarh)
-- ─────────────────────────────────────────────────────────────────────────────

-- Ensure Default Bhilai Owner User & Profile
INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
    'bd877373-87f8-4b44-b5b0-fe1233e45686',
    '00000000-0000-0000-0000-000000000000',
    'owner.bhilai@eduglobin.com',
    '$2a$10$1234567890123456789012',
    NOW(),
    'authenticated',
    'authenticated',
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Bhilai Library Owner"}',
    NOW(),
    NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (id, full_name, role)
VALUES ('bd877373-87f8-4b44-b5b0-fe1233e45686', 'Bhilai Library Partner Owner', 'LIBRARY_OWNER')
ON CONFLICT (id) DO NOTHING;

-- 1. IIT Bhilai Central Knowledge Hub & Library
INSERT INTO libraries (
    id, owner_id, name, slug, locality, city, state, address, geo_point,
    monthly_price, base_desk_price_monthly, base_desk_price_daily,
    is_free, total_seats, seating_type, ac_available, girls_safety_score,
    has_girls_section, amenities, focused_exams, is_published, approval_status,
    rating, contact_number, email, library_category, allow_visitor_passes
) VALUES (
    '11111111-2222-3333-4444-555555555551',
    'bd877373-87f8-4b44-b5b0-fe1233e45686',
    'IIT Bhilai Central Knowledge Hub & Library',
    'iit-bhilai-central-library-v28',
    'IIT Bhilai Campus, Kutelabhata',
    'Bhilai',
    'Chhattisgarh',
    'IIT Bhilai Campus, Kutelabhata, Durg-Bhilai, Chhattisgarh 491001',
    ST_SetSRID(ST_MakePoint(81.3142, 21.2185), 4326)::geography,
    0, 0, 0, TRUE, 30, 'ERGONOMIC', TRUE, 98, TRUE,
    ARRAY['High-Speed WiFi', 'Centralized AC', 'RO Purified Water', '24/7 CCTV Security', 'Power Backup / UPS', 'Sofa Lounge Desks'],
    ARRAY['JEE', 'NEET', 'GATE', 'UPSC', 'RESEARCH'],
    TRUE, 'APPROVED', 4.9, '+91 771 255 1234', 'central.library@iitbhilai.ac.in', 'INSTITUTE', TRUE
) ON CONFLICT (id) DO NOTHING;

-- 2. Chhatrapati Shivaji Study Lounge
INSERT INTO libraries (
    id, owner_id, name, slug, locality, city, state, address, geo_point,
    monthly_price, base_desk_price_monthly, base_desk_price_daily,
    is_free, total_seats, seating_type, ac_available, girls_safety_score,
    has_girls_section, amenities, focused_exams, is_published, approval_status,
    rating, contact_number, email, library_category, allow_visitor_passes
) VALUES (
    '11111111-2222-3333-4444-555555555552',
    'bd877373-87f8-4b44-b5b0-fe1233e45686',
    'Chhatrapati Shivaji Study Lounge & Reading Room',
    'shivaji-study-lounge-smriti-nagar-v28',
    'Smriti Nagar, Junwani Road',
    'Bhilai',
    'Chhattisgarh',
    'Plot 42, Near Surya Treasure Island Mall, Smriti Nagar, Bhilai, CG 490020',
    ST_SetSRID(ST_MakePoint(81.3021, 21.2115), 4326)::geography,
    1200, 1200, 50, FALSE, 24, 'CHAIR', TRUE, 96, TRUE,
    ARRAY['High-Speed WiFi', 'Air Conditioning', 'CCTV 24/7', 'Girls Safety Wing', 'Tea & Coffee Counter', 'Power Backup'],
    ARRAY['UPSC', 'CGPSC', 'SSC', 'Banking'],
    TRUE, 'APPROVED', 4.8, '+91 98271 45678', 'shivaji.study@gmail.com', 'PRIVATE', TRUE
) ON CONFLICT (id) DO NOTHING;
