import fs from 'fs';
import path from 'path';
import pg from 'pg';

const { Client } = pg;

// Parse root .env
const envPath = path.resolve(import.meta.dirname, '..', '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const idx = trimmed.indexOf('=');
    if (idx > -1) {
      env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
    }
  }
});

const DB_HOST = env.DB_HOST || 'localhost';
const DB_PORT = parseInt(env.DB_PORT || '5432');
const DB_NAME = env.DB_NAME || 'eduglobin';
const DB_USER = env.DB_USER || 'postgres';
const DB_PASSWORD = env.DB_PASSWORD || 'postgres';

const REAL_LIBRARIES = [
  {
    name: 'Indore Smart City Free Central Reading Hall',
    slug: 'indore-smart-city-free-central-reading-hall',
    city: 'Indore',
    locality: 'Shivaji Nagar (AICTSL Campus)',
    state: 'Madhya Pradesh',
    lat: 22.7196,
    lng: 75.8577,
    totalSeats: 36,
    seatingType: 'CHAIR',
    acAvailable: true,
    hasGirlsSection: true,
    girlsSafetyScore: 94,
    rating: 4.8,
    isFree: true,
    monthlyPrice: 0.00,
    isFeatured: true,
    email: 'smartcity.library@indore.gov.in',
    hasDiscussionRoom: true,
    discussionRoomCapacity: 12,
    wifiAvailable: true,
    cctvAvailable: true,
    powerBackupAvailable: true,
    waterDispenserAvailable: true,
    newspaperAvailable: true,
    booksCapacity: 650,
    availableBooksData: 'Indore Smart City Public Archive (UPSC Standard NCERT sets, MPPSC, CA Foundation, The Hindu / Dainik Bhaskar Daily)',
    baseDeskPriceDaily: 0.00,
    baseDeskPriceMonthly: 0.00,
    lockerMode: 'FREE_LOCKERS',
    layoutType: 'GENERATED_CLASSROOM',
    proofDocType: 'Municipal Corporation Order',
    proofDocNumber: 'IMC-SMART-2026-PUB-01',
    shifts: [
      { name: 'Morning Shift', start: '06:00:00', end: '12:00:00', daily: 0.00, monthly: 0.00 },
      { name: 'Afternoon Shift', start: '12:00:00', end: '18:00:00', daily: 0.00, monthly: 0.00 },
      { name: 'Evening Shift', start: '18:00:00', end: '00:00:00', daily: 0.00, monthly: 0.00 },
    ],
    seatsCount: 36,
    girlsSeats: 12,
  },
  {
    name: 'Kautilya Central Reading Library & IAS Hub',
    slug: 'kautilya-central-reading-library-ias-hub',
    city: 'Indore',
    locality: 'Bhawarkua Circle',
    state: 'Madhya Pradesh',
    lat: 22.6892,
    lng: 75.8636,
    totalSeats: 36,
    seatingType: 'ERGONOMIC',
    acAvailable: true,
    hasGirlsSection: true,
    girlsSafetyScore: 96,
    rating: 4.9,
    isFree: false,
    monthlyPrice: 900.00,
    isFeatured: true,
    email: 'contact@kautilyalibrary.in',
    hasDiscussionRoom: true,
    discussionRoomCapacity: 8,
    wifiAvailable: true,
    cctvAvailable: true,
    powerBackupAvailable: true,
    waterDispenserAvailable: true,
    newspaperAvailable: true,
    booksCapacity: 500,
    availableBooksData: 'UPSC Mains GS 1-4 standard references (Laxmikanth, Spectrum, Ramesh Singh), NCERT 6-12 sets, Yojana Archives',
    baseDeskPriceDaily: 150.00,
    baseDeskPriceMonthly: 900.00,
    sofaPriceDaily: 250.00,
    sofaPriceMonthly: 1400.00,
    lockerMode: 'PAID_MANAGED',
    layoutType: 'GENERATED_PODS',
    proofDocType: 'Municipal Trade License',
    proofDocNumber: 'MP-IND-2026-TL-99120',
    shifts: [
      { name: 'Morning Shift', start: '06:00:00', end: '12:00:00', daily: 150.00, monthly: 900.00 },
      { name: 'Afternoon Shift', start: '12:00:00', end: '18:00:00', daily: 150.00, monthly: 900.00 },
      { name: 'Evening Shift', start: '18:00:00', end: '00:00:00', daily: 180.00, monthly: 1100.00 },
    ],
    seatsCount: 36,
    girlsSeats: 10,
  },
  {
    name: 'Takshashila 24x7 Digital Study Hub',
    slug: 'takshashila-24x7-digital-study-hub',
    city: 'Indore',
    locality: 'Geeta Bhawan Square',
    state: 'Madhya Pradesh',
    lat: 22.7150,
    lng: 75.8850,
    totalSeats: 36,
    seatingType: 'MIXED',
    acAvailable: true,
    hasGirlsSection: true,
    girlsSafetyScore: 92,
    rating: 4.8,
    isFree: false,
    monthlyPrice: 850.00,
    isFeatured: true,
    email: 'help@takshashilastudy.com',
    hasDiscussionRoom: true,
    discussionRoomCapacity: 6,
    wifiAvailable: true,
    cctvAvailable: true,
    powerBackupAvailable: true,
    waterDispenserAvailable: true,
    newspaperAvailable: true,
    booksCapacity: 400,
    availableBooksData: 'CA Foundation & Inter archives, NEET Biology modules, JEE Advanced problem sets',
    baseDeskPriceDaily: 140.00,
    baseDeskPriceMonthly: 850.00,
    lockerMode: 'PAID_MANAGED',
    layoutType: 'GENERATED_PERIMETER',
    proofDocType: 'Shop & Establishment Certificate',
    proofDocNumber: 'IND-SEC-2026-7812',
    shifts: [
      { name: 'Morning Shift', start: '06:00:00', end: '12:00:00', daily: 140.00, monthly: 850.00 },
      { name: 'Afternoon Shift', start: '12:00:00', end: '18:00:00', daily: 140.00, monthly: 850.00 },
      { name: 'Evening Shift', start: '18:00:00', end: '00:00:00', daily: 160.00, monthly: 950.00 },
    ],
    seatsCount: 36,
    girlsSeats: 8,
  },
  {
    name: 'Saraswati Girls Study Pavilion',
    slug: 'saraswati-girls-study-pavilion',
    city: 'Indore',
    locality: 'Vijay Nagar',
    state: 'Madhya Pradesh',
    lat: 22.7533,
    lng: 75.8937,
    totalSeats: 36,
    seatingType: 'ERGONOMIC',
    acAvailable: true,
    hasGirlsSection: true,
    girlsSafetyScore: 98,
    rating: 4.9,
    isFree: false,
    monthlyPrice: 950.00,
    isFeatured: true,
    email: 'care@saraswatipavilion.org',
    hasDiscussionRoom: true,
    discussionRoomCapacity: 8,
    wifiAvailable: true,
    cctvAvailable: true,
    powerBackupAvailable: true,
    waterDispenserAvailable: true,
    newspaperAvailable: true,
    booksCapacity: 350,
    availableBooksData: 'MPPSC Pre+Mains sets, SSC CGL papers, Banking PO practice manuals',
    baseDeskPriceDaily: 160.00,
    baseDeskPriceMonthly: 950.00,
    lockerMode: 'PAID_MANAGED',
    layoutType: 'GENERATED_DUAL_WING',
    proofDocType: 'GSTIN Registration',
    proofDocNumber: '23AABCS1234F1Z8',
    shifts: [
      { name: 'Morning Shift', start: '06:00:00', end: '12:00:00', daily: 160.00, monthly: 950.00 },
      { name: 'Full Day Shift', start: '06:00:00', end: '21:00:00', daily: 220.00, monthly: 1350.00 },
    ],
    seatsCount: 36,
    girlsSeats: 36, // All reserved for women
  },
  {
    name: 'Dr. B.R. Ambedkar Free Public Study Center',
    slug: 'dr-ambedkar-free-public-study-center',
    city: 'Indore',
    locality: 'Old Palasia',
    state: 'Madhya Pradesh',
    lat: 22.7230,
    lng: 75.8820,
    totalSeats: 30,
    seatingType: 'CHAIR',
    acAvailable: true,
    hasGirlsSection: true,
    girlsSafetyScore: 91,
    rating: 4.7,
    isFree: true,
    monthlyPrice: 0.00,
    isFeatured: true,
    email: 'ambedkar.studycenter@indore.gov.in',
    hasDiscussionRoom: true,
    discussionRoomCapacity: 8,
    wifiAvailable: true,
    cctvAvailable: true,
    powerBackupAvailable: true,
    waterDispenserAvailable: true,
    newspaperAvailable: true,
    booksCapacity: 500,
    availableBooksData: 'Constitutional Law, Civil Services General Studies, State Civil Services guides',
    baseDeskPriceDaily: 0.00,
    baseDeskPriceMonthly: 0.00,
    lockerMode: 'FREE_LOCKERS',
    layoutType: 'GENERATED_CLASSROOM',
    proofDocType: 'Municipal Order',
    proofDocNumber: 'IMC-PAL-2026-042',
    shifts: [
      { name: 'Morning Shift', start: '07:00:00', end: '13:00:00', daily: 0.00, monthly: 0.00 },
      { name: 'Evening Shift', start: '13:00:00', end: '19:00:00', daily: 0.00, monthly: 0.00 },
    ],
    seatsCount: 30,
    girlsSeats: 10,
  },
  {
    name: 'Chanakya Competitive Study Library',
    slug: 'chanakya-competitive-study-library',
    city: 'Indore',
    locality: 'Tower Chouraha (Bhawarkua)',
    state: 'Madhya Pradesh',
    lat: 22.6950,
    lng: 75.8650,
    totalSeats: 36,
    seatingType: 'CHAIR',
    acAvailable: true,
    hasGirlsSection: true,
    girlsSafetyScore: 93,
    rating: 4.7,
    isFree: false,
    monthlyPrice: 800.00,
    isFeatured: true,
    email: 'info@chanakyastudy.in',
    hasDiscussionRoom: true,
    discussionRoomCapacity: 6,
    wifiAvailable: true,
    cctvAvailable: true,
    powerBackupAvailable: true,
    waterDispenserAvailable: true,
    newspaperAvailable: true,
    booksCapacity: 300,
    availableBooksData: 'NCERT Sets, Spectrum Modern India, Lucent GK, Current Affairs Compendiums',
    baseDeskPriceDaily: 130.00,
    baseDeskPriceMonthly: 800.00,
    lockerMode: 'NO_LOCKERS',
    layoutType: 'GENERATED_CLASSROOM',
    proofDocType: 'Shop License',
    proofDocNumber: 'IND-SHOP-2026-5591',
    shifts: [
      { name: 'Morning Shift', start: '06:00:00', end: '12:00:00', daily: 130.00, monthly: 800.00 },
      { name: 'Evening Shift', start: '18:00:00', end: '00:00:00', daily: 150.00, monthly: 900.00 },
    ],
    seatsCount: 36,
    girlsSeats: 8,
  }
];

async function seed() {
  const client = new Client({
    host: DB_HOST,
    port: DB_PORT,
    database: DB_NAME,
    user: DB_USER,
    password: DB_PASSWORD,
  });

  await client.connect();
  console.log('Connected to PostgreSQL successfully.');

  // Find a valid owner profile
  const profileRes = await client.query("SELECT id FROM profiles WHERE role IN ('SUPER_ADMIN', 'LIBRARY_OWNER') LIMIT 1");
  let ownerId = profileRes.rows[0]?.id;
  if (!ownerId) {
    const anyProf = await client.query("SELECT id FROM profiles LIMIT 1");
    ownerId = anyProf.rows[0]?.id;
  }
  if (!ownerId) {
    throw new Error('No profile exists in database to assign as owner.');
  }
  console.log(`Using owner profile ID: ${ownerId}`);

  for (const lib of REAL_LIBRARIES) {
    // Check if library already exists by slug
    const checkRes = await client.query('SELECT id FROM libraries WHERE slug = $1', [lib.slug]);
    let libraryId;

    if (checkRes.rows.length > 0) {
      libraryId = checkRes.rows[0].id;
      console.log(`Library ${lib.name} already exists (${libraryId}). Updating details...`);

      await client.query(`
        UPDATE libraries SET
          name = $1, city = $2, locality = $3, state = $4,
          is_free = $5, monthly_price = $6, rating = $7, girls_safety_score = $8,
          ac_available = $9, has_girls_section = $10, is_published = TRUE, is_featured = TRUE,
          approval_status = 'APPROVED', email = $11, has_discussion_room = $12,
          discussion_room_capacity = $13, wifi_available = $14, cctv_available = $15,
          power_backup_available = $16, water_dispenser_available = $17, newspaper_available = $18,
          books_capacity = $19, available_books_data = $20, base_desk_price_daily = $21,
          base_desk_price_monthly = $22, locker_mode = $23, layout_type = $24
        WHERE id = $25
      `, [
        lib.name, lib.city, lib.locality, lib.state,
        lib.isFree, lib.monthlyPrice, lib.rating, lib.girlsSafetyScore,
        lib.acAvailable, lib.hasGirlsSection, lib.email, lib.hasDiscussionRoom,
        lib.discussionRoomCapacity, lib.wifiAvailable, lib.cctvAvailable,
        lib.powerBackupAvailable, lib.waterDispenserAvailable, lib.newspaperAvailable,
        lib.booksCapacity, lib.availableBooksData, lib.baseDeskPriceDaily,
        lib.baseDeskPriceMonthly, lib.lockerMode, lib.layoutType,
        libraryId
      ]);
    } else {
      console.log(`Inserting real library: ${lib.name}...`);
      const insertLibRes = await client.query(`
        INSERT INTO libraries (
          id, owner_id, name, slug, city, locality, state, geo_point,
          total_seats, seating_type, ac_available, girls_safety_score, has_girls_section,
          cancellation_deadline_hours, is_published, is_featured, rating, monthly_price,
          is_free, approval_status, email, has_discussion_room, discussion_room_capacity,
          wifi_available, cctv_available, power_backup_available, water_dispenser_available,
          newspaper_available, books_capacity, available_books_data, base_desk_price_daily,
          base_desk_price_monthly, sofa_price_daily, sofa_price_monthly, locker_mode,
          layout_type, proof_doc_type, proof_doc_number
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, $6,
          ST_SetSRID(ST_MakePoint($7, $8), 4326)::geography,
          $9, $10, $11, $12, $13,
          24, TRUE, TRUE, $14, $15,
          $16, 'APPROVED', $17, $18, $19,
          $20, $21, $22, $23,
          $24, $25, $26, $27,
          $28, $29, $30, $31,
          $32, $33, $34
        ) RETURNING id
      `, [
        ownerId, lib.name, lib.slug, lib.city, lib.locality, lib.state,
        lib.lng, lib.lat,
        lib.totalSeats, lib.seatingType, lib.acAvailable, lib.girlsSafetyScore, lib.hasGirlsSection,
        lib.rating, lib.monthlyPrice,
        lib.isFree, lib.email, lib.hasDiscussionRoom, lib.discussionRoomCapacity,
        lib.wifiAvailable, lib.cctvAvailable, lib.powerBackupAvailable, lib.waterDispenserAvailable,
        lib.newspaperAvailable, lib.booksCapacity, lib.availableBooksData, lib.baseDeskPriceDaily,
        lib.baseDeskPriceMonthly, lib.sofaPriceDaily || null, lib.sofaPriceMonthly || null, lib.lockerMode,
        lib.layoutType, lib.proofDocType, lib.proofDocNumber
      ]);
      libraryId = insertLibRes.rows[0].id;
    }

    // Insert or update shifts
    const shiftRes = await client.query('SELECT COUNT(*) FROM shifts WHERE library_id = $1', [libraryId]);
    if (parseInt(shiftRes.rows[0].count) === 0) {
      for (const s of lib.shifts) {
        await client.query(`
          INSERT INTO shifts (id, library_id, shift_name, start_time, end_time, daily_price, monthly_price)
          VALUES (gen_random_uuid(), $1, $2, $3::time, $4::time, $5, $6)
        `, [libraryId, s.name, s.start, s.end, s.daily, s.monthly]);
      }
    }

    // Insert seats
    const seatRes = await client.query('SELECT COUNT(*) FROM seat_desks WHERE library_id = $1', [libraryId]);
    if (parseInt(seatRes.rows[0].count) === 0) {
      const rows = ['A', 'B', 'C', 'D', 'E', 'F'];
      const cols = 6;
      for (let i = 0; i < lib.seatsCount; i++) {
        const rIdx = Math.floor(i / cols);
        const cIdx = i % cols;
        const code = `${rows[rIdx % rows.length]}${cIdx + 1}`;
        const isGirls = i < lib.girlsSeats;

        await client.query(`
          INSERT INTO seat_desks (id, library_id, seat_code, row_idx, col_idx, is_girls_only, has_power_socket, current_status)
          VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, TRUE, 'AVAILABLE')
        `, [libraryId, code, rIdx, cIdx, isGirls]);
      }
    }
  }

  await client.end();
  console.log('\n✅ All real libraries seeded successfully!');
}

seed().catch(err => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
