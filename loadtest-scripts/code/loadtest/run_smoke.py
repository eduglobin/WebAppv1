import json
import urllib.request
import urllib.error
import time
import sys
import uuid
import os
import subprocess

sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "http://localhost:8080"

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

def main():
    print("=" * 75)
    print("  SEEDING LOAD TEST DATA & RUNNING K6 SMOKE TEST (3,000 REQUESTS)")
    print("=" * 75)

    # 1. Reset database
    print("\n[1] Clearing database...")
    status, res = make_request(f"{BASE_URL}/api/v1/admin/reset-database", method="POST")
    assert status == 200, f"Failed reset DB: {status}"

    # 2. Register Owner
    owner_email = f"loadtest.owner.{int(time.time())}@iitb.ac.in"
    owner_token, owner_id = generate_test_token(owner_email, role="LIBRARY_OWNER")
    owner_headers = {"Authorization": f"Bearer {owner_token}", "Content-Type": "application/json"}
    make_request(f"{BASE_URL}/api/v1/auth/register", method="POST", headers=owner_headers,
                 data={"fullName": "LoadTest Owner", "role": "LIBRARY_OWNER", "phone": "9876543210"})

    # 3. Create Library & 20 Seats
    seats = []
    for i in range(1, 21):
        seats.append({
            "seatCode": f"S{i}",
            "rowIdx": i // 5,
            "colIdx": i % 5,
            "isGirlsOnly": False,
            "isFree": True,
            "hasPowerSocket": True,
            "distToAcM": 2.0,
            "distToDoorM": 3.0,
            "seatType": "DESK",
            "customTypeName": "Standard Study Desk",
            "customTypeIcon": "STD_DESK"
        })

    onboarding_payload = {
        "name": "Load Test Institute Library",
        "slug": f"loadtest-lib-{int(time.time())}",
        "isFree": True,
        "email": owner_email,
        "contactNumber": "9876543210",
        "address": "Powai",
        "city": "Mumbai",
        "state": "Maharashtra",
        "locality": "Powai",
        "libraryCategory": "INSTITUTE",
        "allowedEmailDomain": "iitb.ac.in",
        "lat": 19.0760,
        "lng": 72.8777,
        "totalSeats": 20,
        "seatingType": "MIXED",
        "acAvailable": True,
        "hasGirlsSection": False,
        "girlsSafetyScore": 95,
        "cancellationDeadlineHours": 24,
        "hasDiscussionRoom": False,
        "discussionRoomCapacity": 0,
        "wifiAvailable": True,
        "cctvAvailable": True,
        "powerBackupAvailable": True,
        "waterDispenserAvailable": True,
        "newspaperAvailable": True,
        "booksCapacity": 500,
        "baseDeskPriceDaily": 0,
        "baseDeskPriceMonthly": 0,
        "sofaPriceDaily": 0,
        "sofaPriceMonthly": 0,
        "lockerMode": "FREE_LOCKERS",
        "layoutType": "GENERATED_CLASSROOM",
        "proofDocType": "Affiliation",
        "proofDocNumber": "LT-100",
        "proofDocUrl": "doc.pdf",
        "kycDocument": "KYC-LT",
        "shifts": [{"shiftName": "Full Day", "startTime": "08:00:00", "endTime": "20:00:00", "dailyPrice": 0, "monthlyPrice": 0}],
        "seats": seats
    }

    status, res = make_request(f"{BASE_URL}/api/v1/owner/libraries", method="POST", data=onboarding_payload, headers=owner_headers)
    assert status == 200 and res.get("success"), f"Failed onboarding: {res}"
    library_id = res["data"]["libraryId"]

    # 4. Admin Approve
    admin_token, _ = generate_test_token("admin@eduglobin.com", role="SUPER_ADMIN")
    admin_headers = {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}
    make_request(f"{BASE_URL}/api/v1/admin/libraries/{library_id}/approve", method="POST", headers=admin_headers)

    # 5. Pre-register 150 Student Profiles for 150 VUs
    print("\n[5] Pre-registering 150 student profiles in database...")
    for i in range(1, 151):
        email = f"vu{i}@iitb.ac.in"
        uid_str = f"00000000-0000-4000-a000-{i:012d}"
        tok, _ = generate_test_token(email, role="STUDENT", user_id=uid_str)
        st_headers = {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}
        make_request(f"{BASE_URL}/api/v1/auth/register", method="POST", headers=st_headers,
                     data={"fullName": f"LoadTester VU {i}", "role": "STUDENT", "phone": f"98765{i:05d}"})

    # 6. Fetch Seat IDs
    status, shifts_res = make_request(f"{BASE_URL}/api/v1/libraries/{library_id}/shifts")
    shift_id = shifts_res["data"][0]["id"]
    status, seats_res = make_request(f"{BASE_URL}/api/v1/libraries/{library_id}/seats?shiftId={shift_id}")
    seats_data = seats_res["data"]
    seat_list = seats_data.get("seats", seats_data) if isinstance(seats_data, dict) else seats_data
    seat_ids = [s["id"] for s in seat_list]

    seat_pool_str = ",".join(seat_ids)

    student_token = "test-token:00000000-0000-4000-a000-000000000001:vu1@iitb.ac.in:STUDENT"
    print(f"\n[DATA SEEDED SUCCESSFULLY!]")
    print(f"Library ID: {library_id}")
    print(f"Student Token (VU 1): {student_token}")
    print(f"Seeded Seat Pool Count: {len(seat_ids)}")
    print("\n[2] Executing k6 run initial-load-test-3000.js ...\n")

    cmd = [
        "k6", "run",
        "--env", f"BASE_URL={BASE_URL}",
        "--env", f"AUTH_TOKEN={student_token}",
        "--env", f"TEST_LIBRARY_ID={library_id}",
        "--env", f"SHIFT_ID={shift_id}",
        "--env", f"SEAT_POOL={seat_pool_str}",
        "initial-load-test-3000.js"
    ]
    subprocess.run(cmd, cwd=os.path.dirname(os.path.abspath(__file__)))

if __name__ == "__main__":
    main()
