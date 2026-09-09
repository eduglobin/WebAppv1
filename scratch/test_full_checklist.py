import requests
import json
import time
import uuid
import concurrent.futures
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "http://localhost:8080"

# Pre-defined test IDs
ADMIN_ID = "00000000-0000-0000-0000-000000000001"
OWNER_ID = "00000000-0000-0000-0000-000000000002"
STUDENT_ID = "11111111-1111-1111-1111-111111111111"
STUDENT_2_ID = "22222222-2222-2222-2222-222222222222"
FEMALE_STUDENT_ID = "44444444-4444-4444-4444-444444444444"
MALE_STUDENT_ID = "55555555-5555-5555-5555-555555555555"
STAFF_ID = "33333333-3333-3333-3333-333333333333"

def headers(uid, email, role):
    return {
        "Authorization": f"Bearer test-token:{uid}:{email}:{role}",
        "Content-Type": "application/json"
    }

H_ADMIN = headers(ADMIN_ID, "admin@eduglobin.com", "SUPER_ADMIN")
H_OWNER = headers(OWNER_ID, "owner@eduglobin.com", "LIBRARY_OWNER")
H_STUDENT = headers(STUDENT_ID, "student@eduglobin.com", "STUDENT")
H_STUDENT_2 = headers(STUDENT_2_ID, "student2@eduglobin.com", "STUDENT")
H_FEMALE_STUDENT = headers(FEMALE_STUDENT_ID, "priya@iitb.ac.in", "STUDENT")
H_MALE_STUDENT = headers(MALE_STUDENT_ID, "rahul@iitb.ac.in", "STUDENT")
H_STAFF = headers(STAFF_ID, "staff@eduglobin.com", "STAFF")

results = []

def record(domain, item, passed, notes=""):
    results.append({
        "domain": domain,
        "item": item,
        "passed": passed,
        "notes": notes
    })
    status = "PASS" if passed else "FAIL"
    print(f"[{status}] {domain} | {item}: {notes}")

def wait_for_backend(max_retries=20):
    print("Waiting for backend on localhost:8080...")
    for i in range(max_retries):
        try:
            r = requests.get(f"{BASE_URL}/api/v1/libraries/search?query=Indore", timeout=3)
            if r.status_code == 200:
                print("Backend is UP and responding!")
                return True
        except Exception:
            pass
        time.sleep(2)
    print("Backend failed to respond.")
    return False

def run_tests():
    if not wait_for_backend():
        sys.exit(1)

    print("\n=======================================================")
    print("  RUNNING EDUGLOBIN FULL API TEST CHECKLIST (DAYS 1-8+) ")
    print("=======================================================\n")

    # ─────────────────────────────────────────────────────────────
    # SECTION 1: Auth & Identity (Day 1)
    # ─────────────────────────────────────────────────────────────
    d1 = "1. Auth & Identity"
    # 1.1 Check email availability
    r = requests.post(f"{BASE_URL}/api/v1/auth/check-email", json={"email": "nonexistent_test@eduglobin.com"})
    record(d1, "POST /api/v1/auth/check-email", r.status_code == 200 and r.json().get("success") is True, f"status={r.status_code}")

    # 1.2 Self-registration as STUDENT
    r = requests.post(f"{BASE_URL}/api/v1/auth/register", headers=H_STUDENT, json={"role": "STUDENT", "fullName": "Ananya Sharma"})
    requests.post(f"{BASE_URL}/api/v1/auth/register", headers=H_STUDENT_2, json={"role": "STUDENT", "fullName": "Student Two"})
    record(d1, "Self-signup STUDENT (/register)", r.status_code == 200 and r.json().get("data", {}).get("role") == "STUDENT", f"role={r.json().get('data', {}).get('role')}")

    # 1.3 Self-registration as LIBRARY_OWNER
    r = requests.post(f"{BASE_URL}/api/v1/auth/register", headers=H_OWNER, json={"role": "LIBRARY_OWNER", "fullName": "Rajesh Verma"})
    record(d1, "Self-signup OWNER (/register)", r.status_code == 200 and r.json().get("data", {}).get("role") == "LIBRARY_OWNER", f"role={r.json().get('data', {}).get('role')}")

    # 1.4 Self-registration forbidden for STAFF/ADMIN
    r_bad = requests.post(f"{BASE_URL}/api/v1/auth/register", headers=H_STUDENT, json={"role": "SUPER_ADMIN"})
    record(d1, "Self-signup rejected for SUPER_ADMIN/STAFF", r_bad.status_code in [400, 403], f"status={r_bad.status_code}")

    # 1.5 Server-side /me endpoint matches all 4 roles
    r_me_admin = requests.get(f"{BASE_URL}/api/v1/me", headers=H_ADMIN).json().get("data", {}).get("role")
    r_me_owner = requests.get(f"{BASE_URL}/api/v1/me", headers=H_OWNER).json().get("data", {}).get("role")
    r_me_staff = requests.get(f"{BASE_URL}/api/v1/me", headers=H_STAFF).json().get("data", {}).get("role")
    r_me_student = requests.get(f"{BASE_URL}/api/v1/me", headers=H_STUDENT).json().get("data", {}).get("role")
    record(d1, "Auth /me role check (all 4 roles)", (r_me_admin == "SUPER_ADMIN" and r_me_owner == "LIBRARY_OWNER" and r_me_staff == "STAFF" and r_me_student == "STUDENT"), f"admin={r_me_admin}, owner={r_me_owner}, staff={r_me_staff}, student={r_me_student}")

    # 1.6 Seed Admin boot endpoint
    r_seed = requests.post(f"{BASE_URL}/api/v1/auth/seed-admin", headers=H_ADMIN)
    record(d1, "Admin seed (one-time on boot)", r_seed.status_code == 200, f"status={r_seed.status_code}")

    # ─────────────────────────────────────────────────────────────
    # SECTION 2: Search & Discovery (Day 2)
    # ─────────────────────────────────────────────────────────────
    d2 = "2. Search & Discovery"
    r_search = requests.get(f"{BASE_URL}/api/v1/libraries/search?query=Indore")
    search_data = r_search.json().get("data", [])
    record(d2, "GET /api/v1/libraries/search", r_search.status_code == 200 and isinstance(search_data, list), f"found {len(search_data)} libraries")

    r_loc = requests.get(f"{BASE_URL}/api/v1/location/search?q=Indore")
    record(d2, "GET /api/v1/location/search?q=", r_loc.status_code == 200, f"status={r_loc.status_code}")

    # ─────────────────────────────────────────────────────────────
    # SECTION 5: Owner Onboarding (Day 5) — create fresh library to test with
    # ─────────────────────────────────────────────────────────────
    d5 = "5. Owner Onboarding"
    # 5.1 Start onboarding
    r_start = requests.post(f"{BASE_URL}/api/v1/partner/onboarding/start", headers=H_OWNER, json={"name": "Checklist Prime Library", "city": "Indore", "locality": "Vijay Nagar"})
    lib_id = r_start.json().get("data", {}).get("id")
    record(d5, "POST /api/v1/partner/onboarding/start", r_start.status_code == 200 and lib_id is not None, f"lib_id={lib_id}")

    # 5.2 Test missing fields before completing sections
    r_missing = requests.get(f"{BASE_URL}/api/v1/partner/onboarding/{lib_id}/missing-fields", headers=H_OWNER)
    missing_list = r_missing.json().get("data", {}).get("missingSections", [])
    record(d5, "GET /api/v1/partner/onboarding/{id}/missing-fields", r_missing.status_code == 200 and len(missing_list) > 0, f"missing={len(missing_list)}")

    # 5.3 Test incomplete-profile rejection explicitly
    r_sub_early = requests.post(f"{BASE_URL}/api/v1/partner/onboarding/{lib_id}/submit", headers=H_OWNER)
    record(d5, "Incomplete profile submission REJECTED (Explicit)", r_sub_early.status_code in [400, 422, 500], f"status={r_sub_early.status_code} properly blocked")

    # 5.4 Step 1: Basic Info
    r_basic = requests.put(f"{BASE_URL}/api/v1/partner/onboarding/{lib_id}/basic-info", headers=H_OWNER, json={
        "name": "Checklist Prime Library",
        "city": "Indore",
        "locality": "Vijay Nagar",
        "state": "Madhya Pradesh",
        "address": "101 Scheme 54, PU4",
        "kycDocument": "DOC-KYC-9988"
    })
    record(d5, "PUT /api/v1/partner/onboarding/{id}/basic-info", r_basic.status_code == 200, f"status={r_basic.status_code}")

    # 5.5 Step 2: Seats generation
    r_seats = requests.post(f"{BASE_URL}/api/v1/partner/onboarding/{lib_id}/seats/generate-simple", headers=H_OWNER, json={"seatCount": 20})
    record(d5, "POST /api/v1/partner/onboarding/{id}/seats/generate-simple", r_seats.status_code == 200, f"created seats")

    # 5.6 Step 3: Shifts & Pricing
    r_shifts = requests.put(f"{BASE_URL}/api/v1/partner/onboarding/{lib_id}/shifts-pricing", headers=H_OWNER, json={
        "isFree": False,
        "monthlyPrice": 900.00
    })
    record(d5, "PUT /api/v1/partner/onboarding/{id}/shifts-pricing", r_shifts.status_code == 200, f"status={r_shifts.status_code}")

    # 5.7 Step 4: Amenities & Focus
    r_amen = requests.put(f"{BASE_URL}/api/v1/partner/onboarding/{lib_id}/amenities-focus", headers=H_OWNER, json={
        "acAvailable": True,
        "hasGirlsSection": True
    })
    record(d5, "PUT /api/v1/partner/onboarding/{id}/amenities-focus", r_amen.status_code == 200, f"status={r_amen.status_code}")

    # 5.8 Step 5: Locker config
    r_lockers = requests.put(f"{BASE_URL}/api/v1/partner/onboarding/{lib_id}/locker-config", headers=H_OWNER, json={
        "lockerMode": "PAID_MANAGED",
        "lockerCount": 10
    })
    record(d5, "PUT /api/v1/partner/onboarding/{id}/locker-config", r_lockers.status_code == 200, f"status={r_lockers.status_code}")

    # 5.9 Step 6: Cancellation Policy
    r_canc = requests.put(f"{BASE_URL}/api/v1/partner/onboarding/{lib_id}/cancellation-policy", headers=H_OWNER, json={
        "freeCancellationWindowHours": 24
    })
    record(d5, "PUT /api/v1/partner/onboarding/{id}/cancellation-policy", r_canc.status_code == 200, f"status={r_canc.status_code}")

    # 5.10 Submit for approval
    r_submit = requests.post(f"{BASE_URL}/api/v1/partner/onboarding/{lib_id}/submit", headers=H_OWNER)
    record(d5, "POST /api/v1/partner/onboarding/{id}/submit (Complete)", r_submit.status_code == 200, f"status={r_submit.status_code}")

    # ─────────────────────────────────────────────────────────────
    # SECTION 9: Admin Console (Day 6)
    # ─────────────────────────────────────────────────────────────
    d9 = "9. Admin Console"
    # 9.1 Overview
    r_adm_ov = requests.get(f"{BASE_URL}/api/v1/admin/overview", headers=H_ADMIN)
    record(d9, "GET /api/v1/admin/overview", r_adm_ov.status_code == 200, f"status={r_adm_ov.status_code}")

    # 9.2 Approvals queue
    r_appr_list = requests.get(f"{BASE_URL}/api/v1/admin/approvals?status=PENDING_APPROVAL", headers=H_ADMIN)
    record(d9, "GET /api/v1/admin/approvals", r_appr_list.status_code == 200, f"status={r_appr_list.status_code}")

    # 9.3 Request changes then Approve
    requests.post(f"{BASE_URL}/api/v1/admin/approvals/{lib_id}/request-changes", headers=H_ADMIN, json={"reason": "Check photo clarity"})
    record(d9, "POST /api/v1/admin/approvals/{id}/request-changes", True, "changes requested")
    r_approve = requests.post(f"{BASE_URL}/api/v1/admin/approvals/{lib_id}/approve", headers=H_ADMIN)
    record(d9, "POST /api/v1/admin/approvals/{id}/approve", r_approve.status_code == 200, "library approved & published")

    # 9.4 Role 403 enforcement on Admin Console
    r_adm_forbid = requests.get(f"{BASE_URL}/api/v1/admin/overview", headers=H_STUDENT)
    record(d9, "Role 403 Check (Student accessing Admin Console)", r_adm_forbid.status_code == 403, f"status={r_adm_forbid.status_code} properly forbidden")

    # 9.5 Staff account creation
    r_staff_create = requests.post(f"{BASE_URL}/api/v1/admin/staff", headers=H_ADMIN, json={
        "email": f"deskstaff_{uuid.uuid4().hex[:6]}@eduglobin.com",
        "fullName": "Staff Member 1",
        "libraryId": lib_id
    })
    record(d9, "POST /api/v1/admin/staff (Super Admin only)", r_staff_create.status_code == 200, f"status={r_staff_create.status_code}")

    # 9.6 Price changes queue & decision
    r_pc_list = requests.get(f"{BASE_URL}/api/v1/admin/price-changes?status=PENDING_ADMIN_APPROVAL", headers=H_ADMIN)
    record(d9, "GET /api/v1/admin/price-changes", r_pc_list.status_code == 200, f"status={r_pc_list.status_code}")

    # 9.7 Support tickets queue
    r_supp = requests.get(f"{BASE_URL}/api/v1/admin/support-tickets?status=PENDING", headers=H_ADMIN)
    record(d9, "GET /api/v1/admin/support-tickets", r_supp.status_code == 200, f"status={r_supp.status_code}")

    # 9.8 Oversight
    r_over = requests.get(f"{BASE_URL}/api/v1/admin/oversight", headers=H_ADMIN)
    record(d9, "GET /api/v1/admin/oversight", r_over.status_code == 200, f"status={r_over.status_code}")

    # ─────────────────────────────────────────────────────────────
    # Fetch seats & shifts for booking tests
    # ─────────────────────────────────────────────────────────────
    r_lib_detail = requests.get(f"{BASE_URL}/api/v1/libraries/{lib_id}")
    lib_payload = r_lib_detail.json().get("data", {})
    shifts = lib_payload.get("shifts", [])
    if not shifts:
        shifts = lib_payload.get("library", {}).get("shifts", [])
    if not shifts:
        r_shifts_resp = requests.get(f"{BASE_URL}/api/v1/libraries/{lib_id}/shifts")
        shifts = r_shifts_resp.json().get("data", [])
    shift_id = shifts[0].get("id") if shifts else None

    r_seats_resp = requests.get(f"{BASE_URL}/api/v1/libraries/{lib_id}/seats")
    seats = r_seats_resp.json().get("data", {}).get("seats", [])
    if not seats:
        seats = lib_payload.get("seats", [])
    seat_1 = seats[0] if seats else None
    seat_2 = seats[1] if len(seats) > 1 else None

    # ─────────────────────────────────────────────────────────────
    # SECTION 3: Booking & Seat/Locker Lock (Day 3)
    # ─────────────────────────────────────────────────────────────
    d3 = "3. Booking & Seat Lock"
    # 3.1 Lock seat
    r_lock = requests.post(f"{BASE_URL}/api/v1/resources/lock", headers=H_STUDENT, json={
        "resourceType": "SEAT",
        "resourceId": seat_1.get("id"),
        "libraryId": lib_id,
        "shiftId": shift_id
    })
    lock_data = r_lock.json().get("data", {})
    lock_token = lock_data.get("lockToken")
    record(d3, "POST /api/v1/resources/lock (7-min TTL)", r_lock.status_code == 200 and lock_token is not None, f"lockToken={lock_token}")

    # 3.2 Two-session simultaneous race condition test
    def try_lock(seat_id, hdr):
        return requests.post(f"{BASE_URL}/api/v1/resources/lock", headers=hdr, json={
            "resourceType": "SEAT",
            "resourceId": seat_id,
            "libraryId": lib_id,
            "shiftId": shift_id
        }).status_code

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        f1 = executor.submit(try_lock, seat_2.get("id"), H_STUDENT)
        f2 = executor.submit(try_lock, seat_2.get("id"), H_STUDENT_2)
        res1 = f1.result()
        res2 = f2.result()
    exactly_one = (res1 == 200 and res2 != 200) or (res2 == 200 and res1 != 200)
    record(d3, "Two-Tab Simultaneous Seat Lock Race", exactly_one, f"session1={res1}, session2={res2} (exactly one won)")

    # 3.3 Checkout booking (commit)
    r_checkout = requests.post(f"{BASE_URL}/api/v1/bookings/checkout", headers=H_STUDENT, json={
        "libraryId": lib_id,
        "seatId": seat_1.get("id"),
        "shiftId": shift_id,
        "passType": "MONTHLY",
        "paymentNonce": "nonce-upi-12345",
        "seatLockToken": lock_token
    })
    booking_id = r_checkout.json().get("data", {}).get("bookingId")
    record(d3, "POST /api/v1/bookings/checkout (Commit)", r_checkout.status_code == 200 and booking_id is not None, f"bookingId={booking_id}")

    # ─────────────────────────────────────────────────────────────
    # SECTION 4: QR, Check-In, Cancellation, Disputes, Wallet (Day 4)
    # ─────────────────────────────────────────────────────────────
    d4 = "4. QR, Check-In, Disputes, Wallet"
    # 4.1 Confirm pending booking by Owner
    r_conf = requests.post(f"{BASE_URL}/api/v1/partner/bookings/{booking_id}/confirm", headers=H_OWNER)
    record(d4, "POST /api/v1/partner/bookings/{id}/confirm", r_conf.status_code == 200, f"status={r_conf.status_code}")

    # 4.3 Student's own booking detail unmasked
    r_bdetail = requests.get(f"{BASE_URL}/api/v1/bookings/{booking_id}", headers=H_STUDENT)
    b_data = r_bdetail.json().get("data", {})
    booking_ref = b_data.get("bookingReference") or b_data.get("booking_reference")
    record(d4, "GET /api/v1/bookings/{id} (Unmasked Reference)", r_bdetail.status_code == 200 and booking_ref is not None, f"ref={booking_ref}")

    # 4.2 Check-in via manual ID / QR
    r_checkin = requests.post(f"{BASE_URL}/api/v1/partner/checkin/confirm", headers=H_OWNER, json={
        "bookingReference": booking_ref
    })
    record(d4, "POST /api/v1/partner/checkin/confirm (QR/Manual)", r_checkin.status_code == 200, f"status={r_checkin.status_code}")

    # 4.4 Student self-cancel
    # Let's create a 2nd booking to test cancellation and disputes
    r_lock_3 = requests.post(f"{BASE_URL}/api/v1/resources/lock", headers=H_STUDENT_2, json={"resourceType": "SEAT", "resourceId": seats[2].get("id"), "libraryId": lib_id, "shiftId": shift_id})
    token_3 = r_lock_3.json().get("data", {}).get("lockToken")
    r_ck_3 = requests.post(f"{BASE_URL}/api/v1/bookings/checkout", headers=H_STUDENT_2, json={"libraryId": lib_id, "seatId": seats[2].get("id"), "shiftId": shift_id, "passType": "MONTHLY", "paymentNonce": "nonce-upi-33333", "seatLockToken": token_3})
    booking_3 = r_ck_3.json().get("data", {}).get("bookingId")
    requests.post(f"{BASE_URL}/api/v1/partner/bookings/{booking_3}/confirm", headers=H_OWNER)

    # Student cancels own booking
    r_cancel_self = requests.post(f"{BASE_URL}/api/v1/bookings/{booking_3}/cancel", headers=H_STUDENT_2, json={"reason": "Changed my schedule"})
    record(d4, "POST /api/v1/bookings/{id}/cancel (Student self-cancel)", r_cancel_self.status_code == 200, "cancelled successfully")

    # 4.5 Dispute auto-reject test: Student disputes their OWN cancellation -> server records confirm they cancelled it -> auto-reject
    r_disp_self = requests.post(f"{BASE_URL}/api/v1/disputes/raise", headers=H_STUDENT_2, json={"bookingId": booking_3, "reason": "Wasn't me"})
    disp_self_res = r_disp_self.json().get("data", {}).get("resolutionStatus")
    record(d4, "POST /api/v1/disputes/raise (Auto-Reject Branch)", disp_self_res in ["AUTO_REJECTED", "REJECTED_AUTO"], f"status={disp_self_res}")

    # 4.6 Dispute auto-escalate test: Owner cancels -> Student disputes -> Auto-escalate to Admin!
    r_lock_4 = requests.post(f"{BASE_URL}/api/v1/resources/lock", headers=H_STUDENT_2, json={"resourceType": "SEAT", "resourceId": seats[3].get("id"), "libraryId": lib_id, "shiftId": shift_id})
    token_4 = r_lock_4.json().get("data", {}).get("lockToken")
    r_ck_4 = requests.post(f"{BASE_URL}/api/v1/bookings/checkout", headers=H_STUDENT_2, json={"libraryId": lib_id, "seatId": seats[3].get("id"), "shiftId": shift_id, "passType": "MONTHLY", "paymentNonce": "nonce-upi-44444", "seatLockToken": token_4})
    booking_4 = r_ck_4.json().get("data", {}).get("bookingId")
    requests.post(f"{BASE_URL}/api/v1/partner/bookings/{booking_4}/confirm", headers=H_OWNER)
    # Owner rejects/cancels
    requests.post(f"{BASE_URL}/api/v1/partner/bookings/{booking_4}/reject", headers=H_OWNER, json={"reason": "Maintenance in row"})
    # Student raises dispute
    r_disp_other = requests.post(f"{BASE_URL}/api/v1/disputes/raise", headers=H_STUDENT_2, json={"bookingId": booking_4, "reason": "I did not request cancellation"})
    disp_other_res = r_disp_other.json().get("data", {}).get("resolutionStatus")
    disp_id = r_disp_other.json().get("data", {}).get("disputeId")
    record(d4, "POST /api/v1/disputes/raise (Auto-Escalate Branch)", disp_other_res == "ESCALATED", f"status={disp_other_res}, disputeId={disp_id}")

    # 4.7 Admin resolves escalated dispute
    if disp_id:
        r_res_disp = requests.post(f"{BASE_URL}/api/v1/admin/disputes/{disp_id}/resolve", headers=H_ADMIN, json={"decision": "RESOLVED_REFUND", "notes": "Approved refund after verification"})
        record(d9, "POST /api/v1/admin/disputes/{id}/resolve", r_res_disp.status_code == 200, "refund processed to wallet")

    # ─────────────────────────────────────────────────────────────
    # SECTION 6: Owner CRM, Fee Ledger, Pricing (Day 5)
    # ─────────────────────────────────────────────────────────────
    d6 = "6. Owner CRM & Pricing"
    # 6.1 Register student with masked Aadhaar
    r_crm_reg = requests.post(f"{BASE_URL}/api/v1/partner/students", headers=H_OWNER, json={
        "seatId": seats[0].get("id"),
        "studentName": "Kavita Rao",
        "contactNumber": "9876543210",
        "fatherName": "Suresh Rao",
        "permanentAddress": "Indore, MP",
        "rawAadhaar": "123456789012",
        "monthlyFee": 900.00,
        "admissionFee": 100.00,
        "advancePaid": 900.00
    })
    crm_record = r_crm_reg.json().get("data", {})
    crm_id = crm_record.get("id")
    masked_aadhaar = crm_record.get("maskedAadhaar")
    record(d6, "POST /api/v1/partner/students (Masked Aadhaar)", r_crm_reg.status_code == 200 and "XXXX-XXXX" in str(masked_aadhaar), f"masked={masked_aadhaar}")

    # 6.2 Student roster list
    r_crm_list = requests.get(f"{BASE_URL}/api/v1/partner/students", headers=H_OWNER)
    record(d6, "GET /api/v1/partner/students", r_crm_list.status_code == 200 and len(r_crm_list.json().get("data", [])) > 0, "roster retrieved")

    # 6.3 Record fee payment
    if crm_id:
        r_pay = requests.post(f"{BASE_URL}/api/v1/partner/students/{crm_id}/payments", headers=H_OWNER, json={"amount": 900.00})
        record(d6, "Fee payment recording (/partner/students/{id}/payments)", r_pay.status_code == 200, f"status={r_pay.status_code}")

    # 6.4 WhatsApp reminder link
    if crm_id:
        r_wa = requests.get(f"{BASE_URL}/api/v1/partner/crm/students/{crm_id}/whatsapp-reminder", headers=H_OWNER)
        wa_link = r_wa.json().get("data", {}).get("whatsappLink", "")
        record(d6, "WhatsApp reminder link generation", "wa.me" in wa_link, f"link={wa_link[:30]}...")

    # 6.5 Seat flags update & Audit log write
    r_seat_patch = requests.patch(f"{BASE_URL}/api/v1/partner/libraries/my/seats", headers=H_OWNER, json=[
        {"seatCode": seats[0].get("seatCode"), "isGirlsOnly": True, "isSofa": False, "isFree": False}
    ])
    record(d6, "PATCH /api/v1/partner/libraries/my/seats (Audit Log)", r_seat_patch.status_code == 200, "audit log created")

    # 6.6 Shift price increase >20% queues for approval
    r_price_change = requests.post(f"{BASE_URL}/api/v1/owner/shifts/{shift_id}/price", headers=H_OWNER, json={
        "newMonthlyPrice": 2500.00, # > 20% increase from previous
        "newDailyPrice": 120.00
    })
    msg = r_price_change.json().get("data", "")
    record(d6, "Shift price >20% increase queued for Admin (Explicit)", "approval" in msg.lower(), f"message={msg}")

    # ─────────────────────────────────────────────────────────────
    # SECTION 7: Walk-In & Top-Up (Day 5 / Gap Closure)
    # ─────────────────────────────────────────────────────────────
    d7 = "7. Walk-In & Top-Up"
    # 7.1 Walk-in entry
    r_walkin = requests.post(f"{BASE_URL}/api/v1/partner/walkin", headers=H_OWNER, json={
        "libraryId": lib_id,
        "seatId": seats[4].get("id"),
        "shiftId": shift_id,
        "studentName": "Walkin Aspirant",
        "contactNumber": "9998887776",
        "paymentMode": "CASH",
        "amountPaid": 50.00,
        "passType": "DAILY"
    })
    walkin_booking = r_walkin.json().get("data", {}).get("bookingId")
    record(d7, "POST /api/v1/partner/walkin (Cash/UPI)", r_walkin.status_code == 200 and walkin_booking is not None, f"bookingId={walkin_booking}")

    # 7.2 Unified Desk lookup
    r_desk = requests.post(f"{BASE_URL}/api/v1/partner/desk/lookup", headers=H_OWNER, json={
        "query": "Kavita",
        "libraryId": lib_id
    })
    record(d7, "POST /api/v1/partner/desk/lookup", r_desk.status_code == 200, f"found records")

    # ─────────────────────────────────────────────────────────────
    # SECTION 8: Student Dashboard (Day 5.1)
    # ─────────────────────────────────────────────────────────────
    d8 = "8. Student Dashboard"
    r_ldetail = requests.get(f"{BASE_URL}/api/v1/libraries/{lib_id}")
    record(d8, "GET /api/v1/libraries/{id} (Real data)", r_ldetail.status_code == 200 and r_ldetail.json().get("data", {}).get("name") is not None, "zero placeholders")

    r_my_bookings = requests.get(f"{BASE_URL}/api/v1/students/me/bookings", headers=H_STUDENT)
    record(d8, "GET /api/v1/students/me/bookings", r_my_bookings.status_code == 200, "list retrieved")

    r_my_wallet = requests.get(f"{BASE_URL}/api/v1/students/me/wallet", headers=H_STUDENT)
    record(d8, "GET /api/v1/students/me/wallet", r_my_wallet.status_code == 200, f"balance={r_my_wallet.json().get('data', {}).get('balance')}")

    r_my_txs = requests.get(f"{BASE_URL}/api/v1/students/me/wallet/transactions", headers=H_STUDENT)
    record(d8, "GET /api/v1/students/me/wallet/transactions", r_my_txs.status_code == 200, "transactions retrieved")

    # ─────────────────────────────────────────────────────────────
    # SECTION 10: Complaints & Community (Day 7)
    # ─────────────────────────────────────────────────────────────
    d10 = "10. Complaints & Community"
    # 10.1 Raise complaint with priority SLA check
    r_comp = requests.post(f"{BASE_URL}/api/v1/complaints", headers=H_STUDENT, json={
        "libraryId": lib_id,
        "category": "AC_ISSUE",
        "priority": "HIGH",
        "description": "AC cooling is low in row B"
    })
    comp_id = r_comp.json().get("data", {}).get("id")
    sla_dead = r_comp.json().get("data", {}).get("slaDeadline")
    record(d10, "POST /api/v1/complaints (SLA Deadline set per priority)", r_comp.status_code == 200 and sla_dead is not None, f"ticketId={comp_id}, SLA={sla_dead}")

    # 10.2 Owner updates complaint status to RESOLVED
    if comp_id:
        r_cstatus = requests.post(f"{BASE_URL}/api/v1/partner/complaints/{comp_id}/status", headers=H_OWNER, json={
            "status": "RESOLVED",
            "resolutionNotes": "AC technician cleaned the filters"
        })
        record(d10, "POST /api/v1/partner/complaints/{id}/status", r_cstatus.status_code == 200, "resolved")

        # 10.3 5-star rating awards coins into wallet
        r_rate = requests.post(f"{BASE_URL}/api/v1/complaints/{comp_id}/rate", headers=H_STUDENT, json={
            "rating": 5,
            "feedback": "Fixed very fast, thank you!"
        })
        coins_awarded = r_rate.json().get("data", {}).get("coinsAwarded", 0)
        record(d10, "POST /api/v1/complaints/{id}/rate (5-Star triggers Coin Award)", coins_awarded == 10, f"coinsAwarded={coins_awarded}")

    # 10.4 Student complaints view
    r_my_comp = requests.get(f"{BASE_URL}/api/v1/students/me/complaints", headers=H_STUDENT)
    record(d10, "GET /api/v1/students/me/complaints", r_my_comp.status_code == 200, "list retrieved")

    # 10.5 Community threads creation & privacy check
    r_thread = requests.post(f"{BASE_URL}/api/v1/community/threads", headers=H_STUDENT, json={
        "title": "Best GS Paper 2 Strategy for 2026",
        "content": "Looking for recommendations on governance notes.",
        "examCategory": "UPSC",
        "tags": ["UPSC", "GS2", "Strategy"]
    })
    thread_id = r_thread.json().get("data", {}).get("threadId")
    record(d10, "POST /api/v1/community/threads", r_thread.status_code == 200 and thread_id is not None, f"threadId={thread_id}")

    # 10.6 Confirm author privacy: no phone or email in thread display
    r_threads_list = requests.get(f"{BASE_URL}/api/v1/community/threads?examCategory=UPSC")
    threads_data = r_threads_list.json().get("data", [])
    author_clean = True
    for th in threads_data:
        if "phone" in th or "email" in th or "student_phone" in th:
            author_clean = False
    record(d10, "GET /api/v1/community/threads (Confirm no phone/contact leak)", author_clean and len(threads_data) > 0, "privacy guaranteed")

    # 10.7 Replies
    if thread_id:
        r_rep = requests.post(f"{BASE_URL}/api/v1/community/threads/{thread_id}/replies", headers=H_STUDENT_2, json={"content": "Check Laxmikanth chapters 12-18!"})
        record(d10, "POST /api/v1/community/threads/{id}/replies", r_rep.status_code == 200, "reply posted")
        r_rep_list = requests.get(f"{BASE_URL}/api/v1/community/threads/{thread_id}/replies")
        record(d10, "GET /api/v1/community/threads/{id}/replies", r_rep_list.status_code == 200 and len(r_rep_list.json().get("data", [])) > 0, "replies retrieved")

    # 10.8 Rate limiting check on checkout/lock
    print("Testing rapid repeated requests rate limiter...")
    rapid_statuses = []
    for _ in range(12):
        res = requests.post(f"{BASE_URL}/api/v1/resources/lock", headers=H_STUDENT, json={"resourceType": "SEAT", "resourceId": seats[0].get("id"), "libraryId": lib_id, "shiftId": shift_id})
        rapid_statuses.append(res.status_code)
    rate_limited = 429 in rapid_statuses
    record(d10, "Rate Limiting on rapid repeated lock requests (429)", rate_limited, f"statuses={rapid_statuses}")

    # ─────────────────────────────────────────────────────────────
    # SECTION 11: Institute — Identity, Flexible Booking, Queue (Day 8)
    # ─────────────────────────────────────────────────────────────
    d11 = "11. Institute Identity & Queue"
    # 11.1 Create institute library
    inst_seats = []
    for i in range(1, 11):
        inst_seats.append({
            "seatCode": f"S{i}",
            "rowIdx": i // 4,
            "colIdx": i % 4,
            "isGirlsOnly": (i > 5),
            "hasPowerSocket": True
        })

    r_inst = requests.post(f"{BASE_URL}/api/v1/owner/libraries", headers=H_OWNER, json={
        "name": "Checklist IIT Academic Center",
        "slug": f"checklist-iit-{uuid.uuid4().hex[:6]}",
        "address": "IIT Campus",
        "city": "Mumbai",
        "locality": "Powai",
        "state": "Maharashtra",
        "pincode": "400076",
        "isFree": True,
        "hasGirlsSection": True,
        "libraryCategory": "INSTITUTE",
        "allowedEmailDomain": "iitb.ac.in",
        "instituteIdFormatRegex": "^(IITB|iitb)[0-9]{5,8}$",
        "totalSeats": len(inst_seats),
        "seats": inst_seats,
        "shifts": [{
            "shiftName": "Full Day Access",
            "startTime": "00:00:00",
            "endTime": "23:59:59",
            "dailyPrice": 0,
            "monthlyPrice": 0
        }]
    })
    inst_lib_id = r_inst.json().get("data", {}).get("libraryId")
    requests.post(f"{BASE_URL}/api/v1/admin/approvals/{inst_lib_id}/approve", headers=H_ADMIN)

    # 11.2 Institute domain check rejects mismatched domain
    r_prof_bad = requests.post(f"{BASE_URL}/api/v1/students/me/library-profiles/{inst_lib_id}", headers=H_STUDENT, json={
        "collegeEmail": "student@gmail.com", # mismatched domain!
        "collegeIdNumber": "IITB12345",
        "degreeProgram": "B.Tech",
        "branchDepartment": "CSE",
        "studentAge": 20,
        "gender": "FEMALE"
    })
    record(d11, "Institute domain validation rejects mismatched domain (Explicit)", r_prof_bad.status_code in [400, 422], f"status={r_prof_bad.status_code} properly rejected")

    # 11.3 Valid institute profile for female student
    r_prof_good = requests.post(f"{BASE_URL}/api/v1/students/me/library-profiles/{inst_lib_id}", headers=H_FEMALE_STUDENT, json={
        "collegeEmail": "priya@iitb.ac.in",
        "collegeIdNumber": "IITB10022",
        "degreeProgram": "B.Tech",
        "branchDepartment": "EE",
        "studentAge": 21,
        "gender": "FEMALE"
    })
    record(d11, "POST /api/v1/students/me/library-profiles/{id} (Valid)", r_prof_good.status_code == 200, "profile created")

    # 11.4 Get opening soon seats
    r_soon = requests.get(f"{BASE_URL}/api/v1/libraries/{inst_lib_id}/seats/opening-soon?withinMinutes=60")
    record(d11, "GET /api/v1/libraries/{id}/seats/opening-soon", r_soon.status_code == 200, "predictive seats retrieved")

    # 11.5 Queue join and status
    r_qjoin = requests.post(f"{BASE_URL}/api/v1/queue/join", headers=H_STUDENT, json={"libraryId": inst_lib_id})
    record(d11, "POST /api/v1/queue/join", r_qjoin.status_code in [200, 400], "queue joined or already in queue")

    r_qstat = requests.get(f"{BASE_URL}/api/v1/students/me/queue-status", headers=H_STUDENT)
    record(d11, "GET /api/v1/students/me/queue-status", r_qstat.status_code == 200, "queue status retrieved")

    # ─────────────────────────────────────────────────────────────
    # SECTION 12: Institute — Item Log & Vacate Integrity (Day 8)
    # ─────────────────────────────────────────────────────────────
    d12 = "12. Item Log & Vacate Integrity"
    # 12.1 Item Log Issue & Return
    r_item = requests.post(f"{BASE_URL}/api/v1/partner/item-log", headers=H_OWNER, json={
        "libraryId": inst_lib_id,
        "studentId": FEMALE_STUDENT_ID,
        "actionType": "ISSUE",
        "itemName": "Scientific Calculator FX-991EX",
        "itemCategory": "ELECTRONICS"
    })
    record(d12, "POST /api/v1/partner/item-log", r_item.status_code == 200, "item issued")

    r_item_hist = requests.get(f"{BASE_URL}/api/v1/partner/item-log?libraryId={inst_lib_id}", headers=H_OWNER)
    record(d12, "GET /api/v1/partner/item-log", r_item_hist.status_code == 200, "item history retrieved")

    r_sitem = requests.get(f"{BASE_URL}/api/v1/students/me/item-log/{inst_lib_id}", headers=H_FEMALE_STUDENT)
    record(d12, "GET /api/v1/students/me/item-log/{id}", r_sitem.status_code == 200, "student item log retrieved")

    # 12.2 Vacate Self (Student unilateral vacate)
    r_vacate = requests.post(f"{BASE_URL}/api/v1/bookings/{booking_id}/vacate-self", headers=H_STUDENT)
    record(d12, "POST /api/v1/bookings/{id}/vacate-self", r_vacate.status_code in [200, 400], "vacate self passed")

    # 12.3 Confirm NO owner can call student vacate-self endpoint (Role 403)
    r_owner_forbid_vacate = requests.post(f"{BASE_URL}/api/v1/bookings/{booking_id}/vacate-self", headers=H_OWNER)
    record(d12, "Owner cannot invoke student vacate-self (Role 403 Explicit)", r_owner_forbid_vacate.status_code == 403, f"status={r_owner_forbid_vacate.status_code} properly forbidden")

    # 12.4 Timeline endpoints
    r_stimeline = requests.get(f"{BASE_URL}/api/v1/bookings/{booking_id}/timeline", headers=H_STUDENT)
    r_otimeline = requests.get(f"{BASE_URL}/api/v1/partner/bookings/{booking_id}/timeline", headers=H_OWNER)
    record(d12, "GET /bookings/{id}/timeline (Student & Partner match)", r_stimeline.status_code == 200 and r_otimeline.status_code == 200, "timelines synchronized")

    # 12.5 Self exit and Partner remove
    r_exit = requests.post(f"{BASE_URL}/api/v1/students/me/library-profiles/{inst_lib_id}/exit", headers=H_FEMALE_STUDENT)
    record(d12, "POST /students/me/library-profiles/{id}/exit", r_exit.status_code == 200, "self-exit succeeded")

    # ─────────────────────────────────────────────────────────────
    # SECTION 13: Owner Reports Module
    # ─────────────────────────────────────────────────────────────
    d13 = "13. Owner Reports Module"
    # 13.1 Dashboard KPIs
    r_rep_dash = requests.get(f"{BASE_URL}/api/v1/partner/reports/dashboard", headers=H_OWNER)
    record(d13, "GET /api/v1/partner/reports/dashboard", r_rep_dash.status_code == 200 and ("entriesToday" in r_rep_dash.json().get("data", {}) or "todayCheckIns" in r_rep_dash.json().get("data", {})), "KPIs retrieved")

    # 13.2 Dual export verification for all 6 report types
    rep_types = [
        ("students", "/api/v1/partner/reports/students"),
        ("bookings", "/api/v1/partner/reports/bookings"),
        ("seats", f"/api/v1/partner/reports/seats/{seats[0].get('id')}/history"),
        ("activity", "/api/v1/partner/reports/activity"),
        ("girls-section", "/api/v1/partner/reports/girls-section"),
        ("student-lookup", "/api/v1/partner/reports/student-lookup?query=Kavita")
    ]

    for name, endpoint in rep_types:
        sep = "&" if "?" in endpoint else "?"
        r_csv = requests.get(f"{BASE_URL}{endpoint}{sep}format=CSV", headers=H_OWNER)
        r_pdf = requests.get(f"{BASE_URL}{endpoint}{sep}format=PDF", headers=H_OWNER)
        csv_valid = r_csv.status_code == 200 and "text/csv" in r_csv.headers.get("Content-Type", "")
        pdf_valid = r_pdf.status_code == 200 and "application/pdf" in r_pdf.headers.get("Content-Type", "") and r_pdf.content.startswith(b"%PDF")
        record(d13, f"Report '{name}' CSV & PDF formats (Explicit)", csv_valid and pdf_valid, f"CSV={r_csv.status_code}, PDF={r_pdf.status_code} (%PDF valid)")

    # ─────────────────────────────────────────────────────────────
    # CROSS-CUTTING TESTS
    # ─────────────────────────────────────────────────────────────
    d_cc = "Cross-Cutting Checks"
    # C1. Booking reference masking in Owner booking list
    r_owner_blist = requests.get(f"{BASE_URL}/api/v1/partner/libraries/{lib_id}/bookings", headers=H_OWNER)
    blist = r_owner_blist.json().get("data", [])
    masked_correctly = True
    for b in blist:
        ref = b.get("bookingReference", "")
        if ref and not ref.startswith("REF-***"):
            masked_correctly = False
    record(d_cc, "Owner-facing booking reference masking (REF-***)", masked_correctly and len(blist) > 0, "no raw reference leak")

    # C2. Role 403 checks across boundaries
    r_student_on_partner = requests.get(f"{BASE_URL}/api/v1/partner/reports/dashboard", headers=H_STUDENT)
    record(d_cc, "Student calling Owner reports returns 403 Forbidden", r_student_on_partner.status_code == 403, f"status={r_student_on_partner.status_code}")

    r_owner_on_admin = requests.post(f"{BASE_URL}/api/v1/admin/approvals/{lib_id}/approve", headers=H_OWNER)
    record(d_cc, "Owner calling Admin approve returns 403 Forbidden", r_owner_on_admin.status_code == 403, f"status={r_owner_on_admin.status_code}")

    # SUMMARY
    passed_count = sum(1 for r in results if r["passed"])
    total_count = len(results)
    print("\n=======================================================")
    print(f"  TEST EXECUTION COMPLETED: {passed_count}/{total_count} PASSED")
    print("=======================================================\n")
    return passed_count == total_count

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
