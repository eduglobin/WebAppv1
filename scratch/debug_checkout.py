import requests
import uuid

BASE_URL = "http://localhost:8080"
rid = uuid.uuid4().hex[:6]
student_email = f"student_dbg_{rid}@test.com"
r_reg = requests.post(f"{BASE_URL}/api/v1/auth/register", json={
    "email": student_email,
    "password": "Password123!",
    "fullName": "Student Debug",
    "role": "STUDENT"
})
print("Register:", r_reg.status_code, r_reg.text)
tok = r_reg.json().get("data", {}).get("token") or r_reg.json().get("token")
print("Token:", bool(tok))

r_search = requests.get(f"{BASE_URL}/api/v1/libraries/search")
libs = r_search.json().get("data", [])
lib = libs[0]
lib_id = lib["id"]
print("Using lib:", lib["name"], lib_id)

r_seats = requests.get(f"{BASE_URL}/api/v1/libraries/{lib_id}/seats").json()
seats = r_seats.get("data", {}).get("seats", [])
shifts = r_seats.get("data", {}).get("library", {}).get("shifts", [])
shift_id = shifts[0]["id"] if shifts else None
seat = seats[0]

hdr = {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}
r_lock = requests.post(f"{BASE_URL}/api/v1/resources/lock", headers=hdr, json={
    "resourceType": "SEAT", "resourceId": seat["id"], "libraryId": lib_id, "shiftId": shift_id
})
print("Lock:", r_lock.status_code, r_lock.text)
lock_tok = r_lock.json().get("data", {}).get("lockToken")

r_ck = requests.post(f"{BASE_URL}/api/v1/bookings/checkout", headers=hdr, json={
    "libraryId": lib_id, "seatId": seat["id"], "shiftId": shift_id, "passType": "MONTHLY",
    "paymentNonce": "nonce-123", "seatLockToken": lock_tok
})
print("Checkout:", r_ck.status_code, r_ck.text)
b_id = r_ck.json().get("data", {}).get("bookingId")

r_cancel = requests.post(f"{BASE_URL}/api/v1/bookings/{b_id}/cancel", headers=hdr, json={"reason": "changed"})
print("Cancel:", r_cancel.status_code, r_cancel.text)

r_disp = requests.post(f"{BASE_URL}/api/v1/disputes/raise", headers=hdr, json={"bookingId": b_id, "reason": "not me"})
print("Dispute:", r_disp.status_code, r_disp.text)
