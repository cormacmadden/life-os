"""
Test geocoding with multiple providers
"""
import asyncio
import httpx
import os
from dotenv import load_dotenv

load_dotenv('backend/.env')

async def test_nominatim(address: str):
    """Test OpenStreetMap Nominatim (free, rate-limited)"""
    print(f"\n=== Testing Nominatim with '{address}' ===")
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://nominatim.openstreetmap.org/search",
                params={
                    "q": address,
                    "format": "json",
                    "limit": 1
                },
                headers={
                    "User-Agent": "LifeOS/1.0"
                },
                timeout=10.0
            )
            print(f"Status: {response.status_code}")
            data = response.json()
            print(f"Response: {data}")
            if data and len(data) > 0:
                lat, lon = float(data[0]["lat"]), float(data[0]["lon"])
                print(f"✓ SUCCESS: {lat}, {lon}")
                return lat, lon
            else:
                print("✗ No results found")
    except Exception as e:
        print(f"✗ ERROR: {e}")
    return None, None

async def test_geocodio(address: str):
    """Test Geocodio (requires API key, US/Canada focused)"""
    api_key = os.getenv("GEOCODIO_API_KEY")
    if not api_key:
        print("\n=== Geocodio: Skipped (no API key) ===")
        return None, None
    
    print(f"\n=== Testing Geocodio with '{address}' ===")
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://api.geocod.io/v1.7/geocode",
                params={
                    "q": address,
                    "api_key": api_key
                },
                timeout=10.0
            )
            print(f"Status: {response.status_code}")
            data = response.json()
            print(f"Response: {data}")
            if data.get("results") and len(data["results"]) > 0:
                location = data["results"][0]["location"]
                lat, lon = location["lat"], location["lng"]
                print(f"✓ SUCCESS: {lat}, {lon}")
                return lat, lon
            else:
                print("✗ No results found")
    except Exception as e:
        print(f"✗ ERROR: {e}")
    return None, None

async def test_positionstack(address: str):
    """Test Positionstack (requires API key, free tier available)"""
    api_key = os.getenv("POSITIONSTACK_API_KEY")
    if not api_key:
        print("\n=== Positionstack: Skipped (no API key) ===")
        return None, None
    
    print(f"\n=== Testing Positionstack with '{address}' ===")
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "http://api.positionstack.com/v1/forward",
                params={
                    "access_key": api_key,
                    "query": address,
                    "limit": 1
                },
                timeout=10.0
            )
            print(f"Status: {response.status_code}")
            data = response.json()
            print(f"Response: {data}")
            if data.get("data") and len(data["data"]) > 0:
                result = data["data"][0]
                lat, lon = result["latitude"], result["longitude"]
                print(f"✓ SUCCESS: {lat}, {lon}")
                return lat, lon
            else:
                print("✗ No results found")
    except Exception as e:
        print(f"✗ ERROR: {e}")
    return None, None

async def test_google_geocoding(address: str):
    """Test Google Geocoding API (requires API key, paid but generous free tier)"""
    api_key = os.getenv("GOOGLE_GEOCODING_API_KEY")
    if not api_key:
        print("\n=== Google Geocoding: Skipped (no API key) ===")
        return None, None
    
    print(f"\n=== Testing Google Geocoding with '{address}' ===")
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://maps.googleapis.com/maps/api/geocode/json",
                params={
                    "address": address,
                    "key": api_key
                },
                timeout=10.0
            )
            print(f"Status: {response.status_code}")
            data = response.json()
            print(f"Response status: {data.get('status')}")
            if data.get("status") == "OK" and data.get("results"):
                location = data["results"][0]["geometry"]["location"]
                lat, lon = location["lat"], location["lng"]
                print(f"✓ SUCCESS: {lat}, {lon}")
                print(f"Formatted address: {data['results'][0]['formatted_address']}")
                return lat, lon
            else:
                print(f"✗ No results found: {data.get('status')}")
    except Exception as e:
        print(f"✗ ERROR: {e}")
    return None, None

async def main():
    test_addresses = [
        "Leamington Spa, UK",
        "Birmingham, UK",
        "University of Warwick, UK"
    ]
    
    for address in test_addresses:
        print(f"\n{'='*60}")
        print(f"Testing: {address}")
        print('='*60)
        
        await test_nominatim(address)
        await asyncio.sleep(1)  # Rate limiting for Nominatim
        await test_positionstack(address)
        await test_geocodio(address)
        await test_google_geocoding(address)

if __name__ == "__main__":
    asyncio.run(main())
