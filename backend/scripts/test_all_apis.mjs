import fs from 'fs';
import path from 'path';

// Parse root .env
const envPath = path.resolve('..', '..', '.env');
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
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = env.SUPABASE_ANON_KEY;
const API_BASE = 'http://localhost:8080';

const ADMIN_EMAIL = env.ADMIN_SEED_EMAIL || 'admin@eduglobin.com';
const ADMIN_PASSWORD = env.ADMIN_SEED_PASSWORD || 'EduglobinAdmin2026!';

const TEST_OWNER_EMAIL = 'api.test.owner@eduglobin.com';
const TEST_STUDENT_EMAIL = 'api.test.student@eduglobin.com';
const TEST_PASSWORD = 'TestPassword2026!';

console.log('═══════════════════════════════════════════════════════════════════');
console.log('🚀 EDUGLOBIN COMPREHENSIVE END-TO-END API VALIDATION SUITE');
console.log('═══════════════════════════════════════════════════════════════════\n');

async function getOrCreateUser(email, role, fullName) {
  const listRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=100`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
  });
  const listData = await listRes.json();
  let user = (listData.users || []).find(u => (u.email || '').toLowerCase() === email.toLowerCase());

  if (!user) {
    const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        password: TEST_PASSWORD,
        email_confirm: true,
        app_metadata: { role },
        user_metadata: { role, full_name: fullName }
      })
    });
    const createData = await createRes.json();
    if (!createRes.ok && createData.code !== 422) {
      throw new Error(`Failed creating ${email}: ${JSON.stringify(createData)}`);
    }
    user = createData;
  }

  const tokenRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: ANON_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email,
      password: role === 'SUPER_ADMIN' ? ADMIN_PASSWORD : TEST_PASSWORD
    })
  });
  const tokenData = await tokenRes.json();
  if (!tokenRes.ok) {
    throw new Error(`Failed sign-in for ${email}: ${JSON.stringify(tokenData)}`);
  }

  if (role !== 'SUPER_ADMIN') {
    await fetch(`${API_BASE}/api/v1/auth/register`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ role, fullName })
    });
  }

  return { user, token: tokenData.access_token };
}

async function runApiTests() {
  let passed = 0;
  let failed = 0;

  function report(name, ok, details = '') {
    if (ok) {
      passed++;
      console.log(`  ✅ [PASS] ${name} ${details}`);
    } else {
      failed++;
      console.error(`  ❌ [FAIL] ${name} ${details}`);
    }
  }

  try {
    // ── 1. TEST ADMIN AUTHENTICATION ──────────────────────────────────────────
    console.log('1️⃣  Testing Admin Identity & Security Endpoints...');
    const adminAuth = await getOrCreateUser(ADMIN_EMAIL, 'SUPER_ADMIN', 'Super Admin');
    const adminToken = adminAuth.token;

    const meAdminRes = await fetch(`${API_BASE}/api/v1/me`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const meAdminData = await meAdminRes.json();
    report(
      'GET /api/v1/me (Admin)',
      meAdminRes.ok && meAdminData.data?.role === 'SUPER_ADMIN',
      `[Role: ${meAdminData.data?.role}]`
    );

    // ── 2. TEST OWNER REGISTRATION & AUTH ─────────────────────────────────────
    console.log('\n2️⃣  Testing Owner Registration & Authentication...');
    const ownerAuth = await getOrCreateUser(TEST_OWNER_EMAIL, 'LIBRARY_OWNER', 'Test Library Owner');
    const ownerToken = ownerAuth.token;

    const meOwnerRes = await fetch(`${API_BASE}/api/v1/me`, {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    const meOwnerData = await meOwnerRes.json();
    report(
      'GET /api/v1/me (Owner)',
      meOwnerRes.ok && meOwnerData.data?.role === 'LIBRARY_OWNER',
      `[Role: ${meOwnerData.data?.role}]`
    );

    // ── 3. TEST LIBRARY ONBOARDING SUBMISSION ──────────────────────────────────
    console.log('\n3️⃣  Testing Library Onboarding Submission API (POST /api/v1/owner/libraries)...');
    const testSlug = `api-test-library-${Date.now()}`;
    const onboardingPayload = {
      name: 'Pragati UPSC Study Hub (API Test)',
      slug: testSlug,
      city: 'Indore',
      state: 'Madhya Pradesh',
      locality: 'Bhawarkua Circle',
      lat: 22.6926,
      lng: 75.8676,
      totalSeats: 20,
      seatingType: 'ERGONOMIC',
      acAvailable: true,
      hasGirlsSection: true,
      girlsSafetyScore: 92,
      cancellationDeadlineHours: 24,
      kycDocument: 'DOC-KYC-MP-API-TEST-2026',
      shifts: [
        {
          shiftName: 'Morning Shift',
          startTime: '06:00:00',
          endTime: '12:00:00',
          dailyPrice: 300,
          monthlyPrice: 600
        },
        {
          shiftName: 'Afternoon Shift',
          startTime: '12:00:00',
          endTime: '18:00:00',
          dailyPrice: 300,
          monthlyPrice: 600
        }
      ],
      seats: [
        { seatCode: 'A1', rowIdx: 0, colIdx: 0, isGirlsOnly: false, hasPowerSocket: true },
        { seatCode: 'A2', rowIdx: 0, colIdx: 1, isGirlsOnly: false, hasPowerSocket: true },
        { seatCode: 'A3', rowIdx: 0, colIdx: 2, isGirlsOnly: true, hasPowerSocket: true }
      ]
    };

    const onboardRes = await fetch(`${API_BASE}/api/v1/owner/libraries`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(onboardingPayload)
    });
    const onboardData = await onboardRes.json();
    const createdLibraryId = onboardData.data?.libraryId;
    report(
      'POST /api/v1/owner/libraries (Onboarding Submission)',
      onboardRes.ok && createdLibraryId != null,
      `[Library ID: ${createdLibraryId}]`
    );

    // ── 4. TEST ADMIN PENDING QUEUE & APPROVAL ─────────────────────────────────
    console.log('\n4️⃣  Testing Admin Verification & Approval Lifecycle...');
    
    const pendingRes = await fetch(`${API_BASE}/api/v1/admin/libraries/pending`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const pendingData = await pendingRes.json();
    const isFoundInPending = (pendingData.data || []).some(l => l.id === createdLibraryId);
    report(
      'GET /api/v1/admin/libraries/pending',
      pendingRes.ok && isFoundInPending,
      `[Pending Count: ${(pendingData.data || []).length} | Target Library in Queue: ${isFoundInPending}]`
    );

    const approveRes = await fetch(`${API_BASE}/api/v1/admin/libraries/${createdLibraryId}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const approveText = await approveRes.text();
    let approveData = {};
    try { approveData = JSON.parse(approveText); } catch(e) {}
    if (!approveRes.ok) {
      console.log('   -> Details of /approve failure:', approveRes.status, approveText);
    }
    report(
      'POST /api/v1/admin/libraries/{id}/approve (Super Admin Approval)',
      approveRes.ok && approveData.success,
      `[Result: ${approveData.data}]`
    );

    // ── 5. TEST STUDENT APIS ──────────────────────────────────────────────────
    console.log('\n5️⃣  Testing Student APIs (Search, Seat Locking & Booking)...');
    const studentAuth = await getOrCreateUser(TEST_STUDENT_EMAIL, 'STUDENT', 'Test Student');
    const studentToken = studentAuth.token;

    const meStudentRes = await fetch(`${API_BASE}/api/v1/me`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    const meStudentData = await meStudentRes.json();
    report(
      'GET /api/v1/me (Student)',
      meStudentRes.ok && meStudentData.data?.role === 'STUDENT',
      `[Role: ${meStudentData.data?.role}]`
    );

    // 5a. Student Search for Approved Libraries
    const searchRes = await fetch(`${API_BASE}/api/v1/libraries/search?sortBy=RATING&limit=10`);
    const searchData = await searchRes.json();
    const searchResults = searchData.data || [];
    const isNewlyApprovedPresent = searchResults.some(l => l.id === createdLibraryId);
    report(
      'GET /api/v1/libraries/search (Public Discovery)',
      searchRes.ok && isNewlyApprovedPresent,
      `[Found ${searchResults.length} libraries | Newly approved present: ${isNewlyApprovedPresent}]`
    );

    // 5b. Fetch Library Detail & Shifts
    const detailRes = await fetch(`${API_BASE}/api/v1/libraries/${createdLibraryId}`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    const detailData = await detailRes.json();
    const availableShifts = detailData.data?.shifts || [];
    const targetShift = availableShifts[0];

    // 5c. Fetch Seats for Shift
    const seatsRes = await fetch(`${API_BASE}/api/v1/libraries/${createdLibraryId}/seats?shiftId=${targetShift?.id}`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    const seatsData = await seatsRes.json();
    const availableSeats = seatsData.data?.seats || [];
    const targetSeat = availableSeats[0];

    report(
      'GET /api/v1/libraries/{id} & /seats (Library Detail, Shifts & Desks)',
      detailRes.ok && targetSeat != null && targetShift != null,
      `[Shifts: ${availableShifts.length} | Desks: ${availableSeats.length}]`
    );

    // 5c. Generalized Redis Seat Lock (10-minute hold)
    const lockPayload = {
      resourceType: 'SEAT',
      resourceId: targetSeat.id,
      libraryId: createdLibraryId,
      shiftId: targetShift.id
    };
    const lockRes = await fetch(`${API_BASE}/api/v1/resources/lock`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(lockPayload)
    });
    const lockData = await lockRes.json();
    const lockToken = lockData.data?.lockToken;
    report(
      'POST /api/v1/resources/lock (10-min Redis Lock Engine)',
      lockRes.ok && lockToken != null,
      `[Lock Token: ${lockToken ? lockToken.slice(0, 8) + '...' : 'none'}]`
    );

    // 5d. Student Checkout / Reservation
    const checkoutPayload = {
      seatLockToken: lockToken,
      seatId: targetSeat.id,
      shiftId: targetShift.id,
      libraryId: createdLibraryId,
      passType: 'DAILY',
      paymentNonce: `PAY-NONCE-${Date.now()}`
    };
    const checkoutRes = await fetch(`${API_BASE}/api/v1/bookings/checkout`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(checkoutPayload)
    });
    const checkoutData = await checkoutRes.json();
    const bookingRef = checkoutData.data?.bookingReference;
    const bookingId = checkoutData.data?.bookingId;
    report(
      'POST /api/v1/bookings/checkout (Reservation Engine & QR Hash)',
      checkoutRes.ok && bookingRef != null,
      `[Booking Ref: ${bookingRef} | ID: ${bookingId}]`
    );

    // 5e. Student Booking Detail
    if (bookingId) {
      const singleBookingRes = await fetch(`${API_BASE}/api/v1/bookings/${bookingId}`, {
        headers: { Authorization: `Bearer ${studentToken}` }
      });
      const singleBookingData = await singleBookingRes.json();
      const qrPayloadVal = singleBookingData.data?.qrPayload || singleBookingData.data?.qr_payload_hash;
      report(
        'GET /api/v1/bookings/{id} (Student Dynamic QR Pass Detail)',
        singleBookingRes.ok && qrPayloadVal != null,
        `[QR Hash: ${qrPayloadVal ? qrPayloadVal.slice(0, 10) + '...' : 'none'}]`
      );
    }

    // ── SUMMARY REPORT ────────────────────────────────────────────────────────
    console.log('\n═══════════════════════════════════════════════════════════════════');
    console.log(`📊 API TEST SUMMARY: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
    console.log('═══════════════════════════════════════════════════════════════════\n');

    if (failed === 0) {
      console.log('🎉 ALL CORE APIS ARE FULLY OPERATIONAL AND VERIFIED!');
    } else {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  }
}

runApiTests();
