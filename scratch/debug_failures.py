import requests

BASE_URL = "http://localhost:8080"
login_std = requests.post(f"{BASE_URL}/api/v1/auth/login", json={"email": "student1@eduglobin.com", "password": "Password123!"}).json()
t_std = login_std.get("token")
h_std = {"Authorization": f"Bearer {t_std}", "Content-Type": "application/json"}

login_own = requests.post(f"{BASE_URL}/api/v1/auth/login", json={"email": "owner1@eduglobin.com", "password": "Password123!"}).json()
t_own = login_own.get("token")
h_own = {"Authorization": f"Bearer {t_own}", "Content-Type": "application/json"}

print("Student token:", bool(t_std), "Owner token:", bool(t_own))

# Let's check student bookings
r_b = requests.get(f"{BASE_URL}/api/v1/students/me/bookings", headers=h_std)
print("Student bookings:", r_b.status_code, r_b.text[:200])

# Let's test dispute raise
r_disp = requests.post(f"{BASE_URL}/api/v1/disputes/raise", headers=h_std, json={"reason": "test"})
print("Dispute no id:", r_disp.status_code, r_disp.text[:200])
