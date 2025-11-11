import requests
import json

url = "http://192.168.4.28:8000/api/user/config"

# Simple test data
data = {
    "home_address": "Test Home",
    "work_address": "Test Work",
    "relevant_routes": "U1, U2",
    "morning_bus_stops": "",
    "evening_bus_stops": ""
}

print("Testing PUT /api/user/config")
print(f"URL: {url}")
print(f"Data: {json.dumps(data, indent=2)}")
print("\nSending request...")

try:
    response = requests.put(url, json=data, timeout=30)
    print(f"\nStatus Code: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
except Exception as e:
    print(f"\nError: {e}")
    if hasattr(e, 'response') and e.response:
        print(f"Response text: {e.response.text}")
