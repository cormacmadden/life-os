import requests

try:
    response = requests.get("http://192.168.4.28:8000/api/weather/current")
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Error: {e}")
