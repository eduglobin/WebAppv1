import requests
import uuid

BASE_URL = "http://localhost:8080"
RUN_ID = uuid.uuid4().hex[:6]

email_owner = f"owner_{RUN_ID}@test.com"
r_reg_own = requests.post(f"{BASE_URL}/api/v1/auth/register", json={"email": email_owner, "password": "Password123!", "fullName": "Owner", "role": "LIBRARY_OWNER"})
t_own = r_reg_own.json().get("token")
H_OWNER = {"Authorization": f"Bearer {t_own}", "Content-Type": "application/json"}

email_student_2 = f"student2_{RUN_ID}@test.com"
r_reg_std2 = requests.post(f"{BASE_URL}/api/v1/auth/register", json={"email": email_student_2, "password": "Password123!", "fullName": "Student 2", "role": "STUDENT"})
t_std2 = r_reg_std2.json().get("token")
H_STUDENT_2 = {"Authorization": f"Bearer {t_std2}", "Content-Type": "application/json"}

r_adm = requests.post(f"{BASE_URL}/api/v1/auth/bootstrap-admin").json()
t_adm = r_adm.get("data", {}).get("token") or r_adm.get("token")
H_ADMIN = {"Authorization": f"Bearer {t_adm}", "Content-Type": "application/json"}

# Start onboarding
r_start = requests.post(f"{BASE_URL}/api/v1/partner/onboarding/start", headers=H_OWNER, json={"name": "Test Lib", "city": "Indore", "state": "MP", "locality": "Vijay"})
lib_id = r_start.json().get("data", {}).get("id")
print("lib_id:", lib_id)

requests.put(f"{BASE_URL}/api/v1/partner/onboarding/{lib_id}/basic-info", headers=H_OWNER, json={"contactNumber": "+91 9999999999", "address": "123 St"})
requests.post(f"{BASE_URL}/api/v1/partner/onboarding/{lib_id}/seats/generate-simple", headers=H_OWNER, json={"seatCount": 10})
requests.put(f"{BASE_URL}/api/v1/partner/onboarding/{lib_id}/shifts-pricing", headers=H_OWNER, json={"isFree": False, "monthlyPrice": 1200})
requests.put(f"{BASE_URL}/api/v1/partner/onboarding/{lib_id}/amenities-focus", headers=H_OWNER, json={"acAvailable": True})
requests.put(f"{BASE_URL}/api/v1/partner/onboarding/{lib_id}/locker-config", headers=H_OWNER, json={"lockerMode": "NO_LOCKERS"})
requests.put(f"{BASE_URL}/api/v1/partner/onboarding/{lib_id}/cancellation-policy", headers=H_OWNER, json={"freeCancellationWindowHours": 24})
requests.post(f"{BASE_URL}/api/v1/partner/onboarding/{lib_id}/submit", headers=H_OWNER)
requests.post(f"{BASE_URL}/api/v1/admin/approvals/{lib_id}/approve", headers=H_ADMIN)

# Fetch seats
r_seats_resp = requests.get(f"{BASE_URL}/api/v1/libraries/{lib_id}/seats")
seats = r_seats_resp.json().get("data", {}).get("seats", [])
shifts = r_seats_resp.json().get("data", {}).get("library", {}).get("shifts", [])
shift_id = shifts[0].get("id")

print(f"Seats count: {len(seats)}, shift_id: {shift_id}")

# Student 2 locks seat 2
r_lock_3 = requests.post(f"{BASE_URL}/api/v1/resources/lock", headers=H_STUDENT_2, json={"resourceType": "SEAT", "resourceId": seats[2]["id"], "libraryId": lib_id, "shiftId": shift_id})
print("Lock 3:", r_lock_3.status_code, r_lock_3.text)
tok_3 = r_lock_3.json().get("data", {}).get("lockToken")

r_ck_3 = requests.post(f"{BASE_URL}/api/v1/bookings/checkout", headers=H_STUDENT_2, json={
    "libraryId": lib_id, "seatId": seats[2]["id"], "shiftId": shift_id, "passType": "MONTHLY", "paymentNonce": "nonce-upi-333", "seatLockToken": tok_3
})
print("Checkout 3:", r_ck_3.status_code, r_ck_3.text)
b_3 = r_ck_3.json().get("data", {}).get("bookingId")

r_conf = requests.post(f"{BASE_URL}/api/v1/partner/bookings/{b_3}/confirm", headers=H_OWNER)
print("Confirm 3:", r_conf.status_code, r_conf.text)

r_cancel_self = requests.post(f"{BASE_URL}/api/v1/bookings/{b_3}/cancel", headers=H_STUDENT_2, json={"reason": "Changed schedule"})
print("Cancel 3:", r_cancel_self.status_code, r_cancel_self.text)

r_disp_self = requests.post(f"{BASE_URL}/api/v1/disputes/raise", headers=H_STUDENT_2, json={"bookingId": b_3, "reason": "Wasn't me"})
print("Dispute self:", r_disp_self.status_code, r_disp_self.text)

# Booking 4
r_lock_4 = requests.post(f"{BASE_URL}/api/v1/resources/lock", headers=H_STUDENT_2, json={"resourceType": "SEAT", "resourceId": seats[3]["id"], "libraryId": lib_id, "shiftId": shift_id})
token_4 = r_lock_4.json().get("data", {}).get("lockToken")
r_ck_4 = requests.post(f"{BASE_URL}/api/v1/bookings/checkout", headers=H_STUDENT_2, json={"libraryId": lib_id, "seatId": seats[3]["id"], "shiftId": shift_id, "passType": "MONTHLY", "paymentNonce": "nonce-upi-444", "seatLockToken": token_4})
b_4 = r_ck_4.json().get("data", {}).get("bookingId")
print("b_4:", b_4)
r_rej = requests.post(f"{BASE_URL}/api/v1/partner/bookings/{b_4}/reject", headers=H_OWNER, json={"reason": "Maintenance in row"})
print("Reject:", r_rej.status_code, r_rej.text)
r_disp_other = requests.post(f"{BASE_URL}/api/v1/disputes/raise", headers=H_STUDENT_2, json={"bookingId": b_4, "reason": "I did not request cancellation"})
print("Dispute escalate:", r_disp_other.status_code, r_disp_other.text)

