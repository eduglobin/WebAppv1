import requests
import json

BASE_URL = "http://localhost:8080"

def test_vacate_and_cancellation_integrity():
    print("--- TESTING MODULES 36-40 INTEGRITY MODEL ---")
    
    # 1. Healthcheck / Endpoint discovery
    resp = requests.get(f"{BASE_URL}/api/v1/health")
    print(f"Healthcheck status: {resp.status_code}")

if __name__ == "__main__":
    test_vacate_and_cancellation_integrity()
