import json
import urllib.request
import urllib.error
import sys

sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "http://localhost:8080"

# Fetch library ID
req = urllib.request.Request(f"{BASE_URL}/api/v1/libraries/search?city=Mumbai")
with urllib.request.urlopen(req) as resp:
    libs = json.loads(resp.read().decode("utf-8"))["data"]

lib_id = libs[0]["id"]
print(f"Testing Library ID: {lib_id}")

token = "test-token:00000000-0000-4000-a000-000000000002:vu1_i0@iitb.ac.in:STUDENT"
headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

queue_payload = json.dumps({"libraryId": lib_id, "seatPreference": "ANY", "requestedDurationMinutes": 60}).encode("utf-8")
queue_req = urllib.request.Request(f"{BASE_URL}/api/v1/libraries/{lib_id}/queue", data=queue_payload, headers=headers, method="POST")
try:
    with urllib.request.urlopen(queue_req) as resp:
        print("Queue Status:", resp.status, resp.read().decode("utf-8"))
except urllib.error.HTTPError as e:
    print("Queue Error Status:", e.code, e.read().decode("utf-8"))
