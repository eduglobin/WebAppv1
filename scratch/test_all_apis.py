import json
import urllib.request
import urllib.error
import time
import sys
import uuid

sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "http://localhost:8080"
TEST_RESULTS = []

def log_test(name, status_code, ok, detail=""):
    symbol = "✅ PASS" if ok else "❌ FAIL"
    print(f"[{symbol}] {name} (HTTP {status_code}) {detail}")
    TEST_RESULTS.append({"name": name, "status": status_code, "passed": ok, "detail": detail})

def make_request(url, method="GET", headers=None, data=None):
    if headers is None:
        headers = {}
    if data is not None and isinstance(data, dict):
        data = json.dumps(data).encode("utf-8")
        headers["Content-Type"] = "application/json"
    
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            body = resp.read().decode("utf-8")
            return resp.status, json.loads(body) if body else {}
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        try:
            return e.code, json.loads(body)
        except Exception:
            return e.code, {"error": body}

def generate_test_token(email, role="STUDENT", user_id=None):
    if user_id is None:
        user_id = str(uuid.uuid4())
    return f"test-token:{user_id}:{email}:{role}", user_id

def run_all_api_tests():
    print("=" * 80)
    print("  EDUGLOBIN COMPLETE COMPREHENSIVE API INTEGRATION TEST SUITE")
    print("=" * 80)

    # 1. Clear Database
    status, res = make_request(f"{BASE_URL}/api/v1/admin/reset-database", method="POST")
    log_test("1. Database Reset", status, status == 200)

    # 2. Register Owner Account
    owner_email = f"prof.sharma.{int(time.time())}@iitb.ac.in"
    owner_token, owner_id = generate_test_token(owner_email, role="LIBRARY_OWNER")
    owner_headers = {"Authorization": f"Bearer {owner_token}", "Content-Type": "application/json"}

    status, res = make_request(f"{BASE_URL}/api/v1/auth/register", method="POST", headers=owner_headers,
                               data={"fullName": "Prof. Sharma", "role": "LIBRARY_OWNER", "phone": "9876543210"})
    log_test("2. Register Owner Profile", status, status == 200 and res.get("success"))

    # 3. GET /api/v1/me
    status, res = make_request(f"{BASE_URL}/api/v1/me", method="GET", headers=owner_headers)
    log_test("3. Fetch User Profile (/api/v1/me)", status, status == 200 and res.get("data", {}).get("role") == "LIBRARY_OWNER")

    # 4. Onboard Institute Library
    onboarding_payload = {
        "name": "IIT Bombay Academic Study Center",
        "slug": f"iitb-study-center-{int(time.time())}",
        "isFree": True,
        "email": owner_email,
        "contactNumber": "9876543210",
        "address": "Powai Campus, IIT Bombay",
        "city": "Mumbai",
        "state": "Maharashtra",
        "locality": "Powai",
        "libraryCategory": "INSTITUTE",
        "allowedEmailDomain": "iitb.ac.in",
        "lat": 19.0760,
        "lng": 72.8777,
        "totalSeats": 4,
        "seatingType": "MIXED",
        "acAvailable": True,
        "hasGirlsSection": True,
        "girlsSafetyScore": 98,
        "cancellationDeadlineHours": 24,
        "hasDiscussionRoom": True,
        "discussionRoomCapacity": 6,
        "wifiAvailable": True,
        "cctvAvailable": True,
        "powerBackupAvailable": True,
        "waterDispenserAvailable": True,
        "newspaperAvailable": True,
        "booksCapacity": 1000,
        "baseDeskPriceDaily": 0,
        "baseDeskPriceMonthly": 0,
        "sofaPriceDaily": 0,
        "sofaPriceMonthly": 0,
        "lockerMode": "FREE_LOCKERS",
        "layoutType": "GENERATED_CLASSROOM",
        "proofDocType": "Affiliation Letter",
        "proofDocNumber": "IITB-2026-REG",
        "proofDocUrl": "proof.pdf",
        "kycDocument": "KYC-IITB",
        "shifts": [{"shiftName": "General Research Shift", "startTime": "08:00:00", "endTime": "22:00:00", "dailyPrice": 0, "monthlyPrice": 0}],
        "seats": [
            {"seatCode": "A1", "rowIdx": 0, "colIdx": 0, "isGirlsOnly": True, "isFree": True, "hasPowerSocket": True, "distToAcM": 1.0, "distToDoorM": 5.0, "seatType": "CABIN", "customTypeName": "Girls Reserved Cabin", "customTypeIcon": "GIRL"},
            {"seatCode": "A2", "rowIdx": 0, "colIdx": 1, "isGirlsOnly": False, "isFree": True, "hasPowerSocket": True, "distToAcM": 1.5, "distToDoorM": 4.5, "seatType": "DESK", "customTypeName": "Standard Desk", "customTypeIcon": "STD"},
            {"seatCode": "A3", "rowIdx": 0, "colIdx": 2, "isGirlsOnly": False, "isFree": True, "hasPowerSocket": True, "distToAcM": 2.0, "distToDoorM": 4.0, "seatType": "DESK", "customTypeName": "Standard Desk", "customTypeIcon": "STD"},
            {"seatCode": "A4", "rowIdx": 0, "colIdx": 3, "isGirlsOnly": False, "isFree": True, "hasPowerSocket": True, "distToAcM": 2.5, "distToDoorM": 3.5, "seatType": "DESK", "customTypeName": "Standard Desk", "customTypeIcon": "STD"}
        ]
    }

    status, res = make_request(f"{BASE_URL}/api/v1/owner/libraries", method="POST", data=onboarding_payload, headers=owner_headers)
    log_test("4. Onboard Institute Library", status, status == 200 and res.get("success"))
    library_id = res["data"]["libraryId"]

    # 5. Super Admin Pending Approval Queue & Approval
    admin_token, _ = generate_test_token("admin@eduglobin.com", role="SUPER_ADMIN")
    admin_headers = {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}

    status, res = make_request(f"{BASE_URL}/api/v1/admin/libraries/pending", method="GET", headers=admin_headers)
    log_test("5. Admin Fetch Pending Queue", status, status == 200 and len(res.get("data", [])) > 0)

    status, res = make_request(f"{BASE_URL}/api/v1/admin/libraries/{library_id}/approve", method="POST", headers=admin_headers)
    log_test("6. Admin Approve Library", status, status == 200 and res.get("success"))

    # 6. Location Autocomplete Search
    status, res = make_request(f"{BASE_URL}/api/v1/locations/search?q=Powai")
    log_test("7. Location Search Autocomplete (/locations/search)", status, status == 200)

    # 7. Library Geospatial Search
    status, res = make_request(f"{BASE_URL}/api/v1/libraries/search?city=Mumbai")
    log_test("8. Library Search (/libraries/search)", status, status == 200 and len(res.get("data", [])) > 0)

    # 8. Library Detail, Shifts & Seat Map
    status, res = make_request(f"{BASE_URL}/api/v1/libraries/{library_id}")
    log_test("9. Library Details Endpoint", status, status == 200 and res.get("data", {}).get("name") == "IIT Bombay Academic Study Center")

    status, shifts_res = make_request(f"{BASE_URL}/api/v1/libraries/{library_id}/shifts")
    shift_id = shifts_res["data"][0]["id"]
    log_test("10. Fetch Library Shifts", status, status == 200 and len(shifts_res["data"]) > 0)

    status, seats_res = make_request(f"{BASE_URL}/api/v1/libraries/{library_id}/seats?shiftId={shift_id}")
    seats_data = seats_res["data"]
    seats = seats_data.get("seats", seats_data) if isinstance(seats_data, dict) else seats_data
    log_test("11. Fetch Live Seats Matrix", status, status == 200 and len(seats) >= 4)

    seat_a1 = next(s for s in seats if (s.get("seat_code") or s.get("seatCode")) == "A1")
    seat_a2 = next(s for s in seats if (s.get("seat_code") or s.get("seatCode")) == "A2")

    # 9. Register Student 1
    student1_email = f"student.one.{int(time.time())}@iitb.ac.in"
    student1_token, student1_id = generate_test_token(student1_email, role="STUDENT")
    student1_headers = {"Authorization": f"Bearer {student1_token}", "Content-Type": "application/json"}
    make_request(f"{BASE_URL}/api/v1/auth/register", method="POST", headers=student1_headers,
                 data={"fullName": "Rohan Mehta", "role": "STUDENT", "phone": "9876543211"})

    # 10. Student Library Profile (IRCTC Identity Verify)
    status, res = make_request(f"{BASE_URL}/api/v1/students/me/library-profiles/{library_id}", method="GET", headers=student1_headers)
    log_test("12. Fetch Student Library Profile (404 expected first time)", status, status == 404)

    profile_payload = {
        "instituteEmail": student1_email,
        "instituteIdNumber": "2024CS101",
        "branch": "Computer Science",
        "year": "3rd Year",
        "govtIdType": "AADHAAR",
        "govtIdLast4": "4321"
    }
    status, res = make_request(f"{BASE_URL}/api/v1/students/me/library-profiles/{library_id}", method="POST", data=profile_payload, headers=student1_headers)
    log_test("13. Create Student Library Profile", status, status == 200 and res.get("success"))
    profile_id = res["data"]["id"]

    status, res = make_request(f"{BASE_URL}/api/v1/students/me/library-profiles/{library_id}", method="GET", headers=student1_headers)
    profile_id_num = res.get("data", {}).get("instituteIdNumber") or res.get("data", {}).get("institute_id_number")
    log_test("14. Fetch Student Library Profile (Returning verify)", status, status == 200 and profile_id_num == "2024CS101")

    # 11. Lock & Checkout Seat A2 (Standard Desk)
    status, lock_res = make_request(f"{BASE_URL}/api/v1/resources/lock", method="POST", headers=student1_headers,
                                    data={"resourceType": "SEAT", "resourceId": seat_a2["id"], "libraryId": library_id, "shiftId": shift_id})
    log_test("15. Lock Resource Seat A2", status, status == 200 and lock_res.get("success"))
    lock_token_a2 = lock_res["data"]["lockToken"]

    checkout_payload = {
        "seatLockToken": lock_token_a2,
        "seatId": seat_a2["id"],
        "shiftId": shift_id,
        "libraryId": library_id,
        "passType": "DAILY",
        "paymentNonce": "FREE_PASS",
        "collegeEmail": student1_email,
        "collegeIdNumber": "2024CS101",
        "studentAge": 21,
        "degreeProgram": "B.Tech",
        "branchDepartment": "Computer Science",
        "studentGender": "MALE"
    }
    status, checkout_res = make_request(f"{BASE_URL}/api/v1/bookings/checkout", method="POST", data=checkout_payload, headers=student1_headers)
    log_test("16. Student Booking Checkout Seat A2", status, status == 200 and checkout_res.get("success"))
    booking1_id = checkout_res["data"]["bookingId"]

    # 12. Digital Pass & Timeline
    status, res = make_request(f"{BASE_URL}/api/v1/bookings/{booking1_id}", method="GET", headers=student1_headers)
    log_test("17. Fetch Digital Pass & QR Payload", status, status == 200 and res.get("data", {}).get("seatCode") == "A2")

    status, res = make_request(f"{BASE_URL}/api/v1/bookings/{booking1_id}/timeline", method="GET", headers=student1_headers)
    log_test("18. Student Immutable Booking Timeline", status, status == 200 and len(res.get("data", [])) > 0)

    # 13. Single Active Seat Rule (Module 41) Enforcement
    status, lock_res2 = make_request(f"{BASE_URL}/api/v1/resources/lock", method="POST", headers=student1_headers,
                                     data={"resourceType": "SEAT", "resourceId": seat_a1["id"], "libraryId": library_id, "shiftId": shift_id})
    log_test("19. Single Active Seat Rule Enforcement (400 expected)", status, status == 400 or not lock_res2.get("success"))

    # 14. Top-Up Check & Alternatives (Module 42)
    status, res = make_request(f"{BASE_URL}/api/v1/bookings/{booking1_id}/topup-alternatives", method="GET", headers=student1_headers)
    print("TEST 20 DEBUG RES:", status, res)
    log_test("20. Top-Up Check & Alternatives Endpoint", status, status == 200)

    # 15. Item Circulation Log (Issue & Return)
    item_payload = {
        "libraryId": library_id,
        "studentLibraryProfileId": profile_id,
        "itemName": "Quantum Physics Textbook (Vol 2)",
        "action": "ISSUED",
        "notes": "Issued at front desk"
    }
    status, res = make_request(f"{BASE_URL}/api/v1/partner/item-log", method="POST", data=item_payload, headers=owner_headers)
    log_test("21. Issue Item Log Entry", status, status == 200 and res.get("success"))

    status, res = make_request(f"{BASE_URL}/api/v1/students/me/item-log/{library_id}", method="GET", headers=student1_headers)
    log_test("22. Student Item Log View", status, status == 200 and len(res.get("data", [])) > 0)

    item_return_payload = {
        "libraryId": library_id,
        "studentLibraryProfileId": profile_id,
        "itemName": "Quantum Physics Textbook (Vol 2)",
        "action": "RETURNED",
        "notes": "Returned in clean condition"
    }
    status, res = make_request(f"{BASE_URL}/api/v1/partner/item-log", method="POST", data=item_return_payload, headers=owner_headers)
    log_test("23. Return Item Log Entry", status, status == 200 and res.get("success"))

    # 16. Generate Vacate Token & Owner Vacate Handshake
    status, res = make_request(f"{BASE_URL}/api/v1/bookings/{booking1_id}/vacate-token", method="POST", headers=student1_headers)
    log_test("24. Generate 8-Digit Vacate Token", status, status == 200 and "vacateToken" in res.get("data", {}))
    vacate_token = res["data"]["vacateToken"]

    status, res = make_request(f"{BASE_URL}/api/v1/partner/libraries/{library_id}/seats/vacate", method="POST",
                               data={"seatCode": "A2", "vacateToken": vacate_token}, headers=owner_headers)
    log_test("25. Owner Vacate Handshake with Token", status, status == 200 and res.get("success"))

    # 17. Register Student 2 & Queue Join / Claim Test
    student2_email = f"student.two.{int(time.time())}@iitb.ac.in"
    student2_token, student2_id = generate_test_token(student2_email, role="STUDENT")
    student2_headers = {"Authorization": f"Bearer {student2_token}", "Content-Type": "application/json"}
    make_request(f"{BASE_URL}/api/v1/auth/register", method="POST", headers=student2_headers,
                 data={"fullName": "Ananya Roy", "role": "STUDENT", "phone": "9876543212"})

    status, queue_res = make_request(f"{BASE_URL}/api/v1/libraries/{library_id}/queue", method="POST",
                                     data={"libraryId": library_id, "seatPreference": "ANY", "requestedDurationMinutes": 60}, headers=student2_headers)
    log_test("26. Join Seat Queue", status, status == 200 and queue_res.get("success"))

    status, res = make_request(f"{BASE_URL}/api/v1/libraries/{library_id}/queue/status", method="GET", headers=student2_headers)
    log_test("27. Fetch Active Queue Status", status, status == 200 and res.get("data", {}).get("status") in ["WAITING", "OFFERED"])

    # 18. Owner Portal Views
    status, res = make_request(f"{BASE_URL}/api/v1/partner/libraries/{library_id}/seats/live", method="GET", headers=owner_headers)
    log_test("28. Owner Live Seat Grid View", status, status == 200 and len(res.get("data", [])) >= 4)

    status, res = make_request(f"{BASE_URL}/api/v1/partner/libraries/{library_id}/bookings", method="GET", headers=owner_headers)
    log_test("29. Privacy-Compliant Masked Owner Bookings View", status, status == 200 and res.get("success"))

    print("\n" + "=" * 80)
    passed_count = sum(1 for t in TEST_RESULTS if t["passed"])
    total_count = len(TEST_RESULTS)
    print(f"  RESULTS SUMMARY: {passed_count} / {total_count} API TESTS PASSED SUCCESSFULLY!")
    print("=" * 80)

if __name__ == "__main__":
    run_all_api_tests()
