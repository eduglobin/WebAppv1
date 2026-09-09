import fs from 'fs';
import path from 'path';

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

const SUPABASE_URL = env.SUPABASE_URL || 'https://ifojeggpbgvvmdzcqpvo.supabase.co';
const ANON_KEY = env.SUPABASE_ANON_KEY;
const API_BASE = 'http://localhost:8080';
const ADMIN_EMAIL = env.ADMIN_SEED_EMAIL || 'admin@eduglobin.com';
const ADMIN_PASSWORD = env.ADMIN_SEED_PASSWORD || 'EduglobinAdmin2026!';

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${message}`);
}

async function supabaseSignIn(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: ANON_KEY,
    },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`SignIn failed for ${email}: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function supabaseSignUp(email, password, role) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: ANON_KEY,
    },
    body: JSON.stringify({
      email,
      password,
      data: { role, preferred_language: 'en', preferred_theme: 'DARK' },
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`SignUp failed for ${email}: ${JSON.stringify(data)}`);
  return data.access_token || (await supabaseSignIn(email, password));
}

async function run() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(' EDUGLOBIN ENRICHED ONBOARDING VERIFICATION TEST ');
  console.log('═══════════════════════════════════════════════════════════════════');

  // 1. Authenticate Admin
  console.log('\n[1] Authenticating Super Admin...');
  const adminToken = await supabaseSignIn(ADMIN_EMAIL, ADMIN_PASSWORD);
  assert(adminToken != null, 'Admin token acquired');

  // 2. Register new Owner
  const ownerEmail = `owner_enriched_${Date.now()}@eduglobin.test`;
  const ownerPassword = 'OwnerSecurePassword2026!';
  console.log(`\n[2] Registering fresh Library Owner (${ownerEmail})...`);
  let ownerToken = await supabaseSignUp(ownerEmail, ownerPassword, 'LIBRARY_OWNER');

  // Provision role in backend profiles table
  const regRes = await fetch(`${API_BASE}/api/v1/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ownerToken}`,
    },
    body: JSON.stringify({ role: 'LIBRARY_OWNER' }),
  });
  const regData = await regRes.json();
  assert(regRes.ok && regData.success, 'Owner role registered in profiles');

  // Re-sign in to obtain updated JWT
  ownerToken = await supabaseSignIn(ownerEmail, ownerPassword);

  // 3. Submit Enriched Onboarding Questionnaire
  console.log('\n[3] Submitting Enriched Onboarding Questionnaire with all requested fields...');
  const onboardingPayload = {
    name: 'Indore Central UPSC & Exam Hub',
    slug: `indore-exam-hub-${Date.now()}`,
    email: 'contact@indorehub.in',
    city: 'Indore',
    locality: 'Bhawarkua Circle',
    state: 'Madhya Pradesh',
    lat: 22.6926,
    lng: 75.8676,
    totalSeats: 30,
    seatingType: 'MIXED',
    acAvailable: true,
    hasGirlsSection: true,
    girlsSafetyScore: 94,
    cancellationDeadlineHours: 24,

    // 1. Discussion Room
    hasDiscussionRoom: true,
    discussionRoomCapacity: 8,

    // 2. Facilities & Amenities
    wifiAvailable: true,
    cctvAvailable: true,
    powerBackupAvailable: true,
    waterDispenserAvailable: true,
    newspaperAvailable: true,

    // 3. Books Capacity & Data
    booksCapacity: 450,
    availableBooksData: 'UPSC Mains GS 1-4 standard references, NCERT sets 6-12, NEET Modules, The Hindu archives',

    // 4. Base Pricing (Desks & Sofas)
    baseDeskPriceDaily: 350.00,
    baseDeskPriceMonthly: 900.00,
    sofaPriceDaily: 500.00,
    sofaPriceMonthly: 1400.00,

    // 5. Locker Service
    lockerMode: 'PAID_MANAGED',

    // 6. Layout Options (e.g. GENERATED_CLASSROOM)
    layoutType: 'GENERATED_CLASSROOM',
    layoutFileUrl: null,

    // 7. Document of Proof (PDF & Number)
    proofDocType: 'Municipal Trade License',
    proofDocNumber: 'MP-IND-2026-TL-84920',
    proofDocUrl: 'Trade_License_IndoreHub_2026.pdf',
    kycDocument: 'MP-IND-2026-TL-84920',

    shifts: [
      { shiftName: 'Morning Shift', startTime: '06:00:00', endTime: '12:00:00', dailyPrice: 350.00, monthlyPrice: 900.00 },
      { shiftName: 'Afternoon Shift', startTime: '12:00:00', endTime: '18:00:00', dailyPrice: 350.00, monthlyPrice: 900.00 },
      { shiftName: 'Evening Shift', startTime: '18:00:00', endTime: '00:00:00', dailyPrice: 400.00, monthlyPrice: 1000.00 },
      { shiftName: 'Night Shift', startTime: '00:00:00', endTime: '06:00:00', dailyPrice: 300.00, monthlyPrice: 750.00 },
    ],
    seats: [
      { seatCode: 'A1', rowIdx: 0, colIdx: 0, isGirlsOnly: true, hasPowerSocket: true },
      { seatCode: 'A2', rowIdx: 0, colIdx: 1, isGirlsOnly: true, hasPowerSocket: true },
      { seatCode: 'A3', rowIdx: 0, colIdx: 2, isGirlsOnly: false, hasPowerSocket: true },
      { seatCode: 'A4', rowIdx: 0, colIdx: 3, isGirlsOnly: false, hasPowerSocket: true },
    ]
  };

  const onboardRes = await fetch(`${API_BASE}/api/v1/owner/libraries`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ownerToken}`,
    },
    body: JSON.stringify(onboardingPayload),
  });
  const onboardData = await onboardRes.json();
  assert(onboardRes.ok && onboardData.success, 'Enriched onboarding submission accepted (HTTP 200)');
  const libraryId = onboardData.data.libraryId;
  console.log(`  -> Assigned Library ID: ${libraryId}`);

  // 4. Query /partner/libraries/my
  console.log('\n[4] Querying owner library details via /partner/libraries/my...');
  const myLibRes = await fetch(`${API_BASE}/api/v1/partner/libraries/my`, {
    headers: { Authorization: `Bearer ${ownerToken}` },
  });
  const myLibData = await myLibRes.json();
  assert(myLibRes.ok && myLibData.success && myLibData.data, 'Owner library retrieved');
  const myLib = myLibData.data;

  assert(myLib.email === 'contact@indorehub.in', `Contact Email: ${myLib.email}`);
  assert(myLib.has_discussion_room === true, `Discussion Room Available: ${myLib.has_discussion_room}`);
  assert(myLib.discussion_room_capacity === 8, `Discussion Room Capacity: ${myLib.discussion_room_capacity} seats`);
  assert(myLib.wifi_available === true, 'WiFi Available: true');
  assert(myLib.cctv_available === true, 'CCTV Available: true');
  assert(myLib.power_backup_available === true, 'Power Backup Available: true');
  assert(myLib.water_dispenser_available === true, 'Water Dispenser Available: true');
  assert(myLib.newspaper_available === true, 'Newspaper Available: true');
  assert(myLib.books_capacity === 450, `Books Capacity: ${myLib.books_capacity} volumes`);
  assert(Number(myLib.base_desk_price_daily) === 350, `Base Desk Price Daily: ₹${myLib.base_desk_price_daily}`);
  assert(Number(myLib.base_desk_price_monthly) === 900, `Base Desk Price Monthly: ₹${myLib.base_desk_price_monthly}`);
  assert(Number(myLib.sofa_price_daily) === 500, `Sofa Price Daily: ₹${myLib.sofa_price_daily}`);
  assert(Number(myLib.sofa_price_monthly) === 1400, `Sofa Price Monthly: ₹${myLib.sofa_price_monthly}`);
  assert(myLib.locker_mode === 'PAID_MANAGED', `Locker Mode: ${myLib.locker_mode}`);
  assert(myLib.layout_type === 'GENERATED_CLASSROOM', `Layout Archetype: ${myLib.layout_type}`);
  assert(myLib.proof_doc_type === 'Municipal Trade License', `Proof Doc Type: ${myLib.proof_doc_type}`);
  assert(myLib.proof_doc_number === 'MP-IND-2026-TL-84920', `Proof Doc Number: ${myLib.proof_doc_number}`);
  assert(myLib.approval_status === 'PENDING_APPROVAL', 'Current status: PENDING_APPROVAL');

  // 5. Admin retrieves pending queue
  console.log('\n[5] Super Admin inspecting pending approval queue...');
  const pendingRes = await fetch(`${API_BASE}/api/v1/admin/libraries/pending`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const pendingData = await pendingRes.json();
  assert(pendingRes.ok && pendingData.success && Array.isArray(pendingData.data), 'Pending list retrieved');
  const foundInPending = pendingData.data.find(l => l.id === libraryId);
  assert(foundInPending != null, 'New library found in pending approval queue');
  assert(foundInPending.email === 'contact@indorehub.in', 'Admin sees contact email in dossier');
  assert(foundInPending.proof_doc_number === 'MP-IND-2026-TL-84920', 'Admin sees proof document number in dossier');
  assert(foundInPending.books_capacity === 450, 'Admin sees books capacity in dossier');

  // 6. Admin Approves Library
  console.log(`\n[6] Admin approving library ${libraryId}...`);
  const approveRes = await fetch(`${API_BASE}/api/v1/admin/libraries/${libraryId}/approve`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const approveData = await approveRes.json();
  assert(approveRes.ok && approveData.success, 'Super Admin approval succeeded');

  // 7. Verify Owner sees APPROVED status
  console.log('\n[7] Owner checking updated status...');
  const approvedRes = await fetch(`${API_BASE}/api/v1/partner/libraries/my`, {
    headers: { Authorization: `Bearer ${ownerToken}` },
  });
  const approvedData = await approvedRes.json();
  assert(approvedData.data?.approval_status === 'APPROVED', 'Library status updated to APPROVED');

  console.log('\n===================================================================');
  console.log(' 🎉 100% SUCCESS: ALL 18 ENRICHED ONBOARDING ASSERTIONS PASSED! ');
  console.log('===================================================================');
}

run().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
