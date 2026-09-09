import requests

BASE_URL = "http://localhost:8080"
H_OWNER = {"Authorization": "Bearer test-token:00000000-0000-0000-0000-000000000002:owner@eduglobin.com:LIBRARY_OWNER", "Content-Type": "application/json"}

# Find any shift
r_search = requests.get(f"{BASE_URL}/api/v1/libraries/search")
libs = r_search.json().get("data", [])
lib_id = libs[0]["id"]
r_seats = requests.get(f"{BASE_URL}/api/v1/libraries/{lib_id}/seats").json()
shifts = r_seats.get("data", {}).get("library", {}).get("shifts", [])
shift_id = shifts[0]["id"]

print("Shift id:", shift_id)
r = requests.post(f"{BASE_URL}/api/v1/owner/shifts/{shift_id}/price", headers=H_OWNER, json={"newMonthlyPrice": 2500.00, "newDailyPrice": 120.00})
print("Price response:", r.status_code, r.text)
