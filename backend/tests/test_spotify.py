import asyncio
import httpx
import json
import os
from dotenv import load_dotenv

# Load tokens
TOKEN_FILE = "spotify_tokens.json"
if os.path.exists(TOKEN_FILE):
    with open(TOKEN_FILE, 'r') as f:
        tokens = json.load(f)
        access_token = tokens.get("access_token")
else:
    print("No token file found")
    exit(1)

async def test_spotify():
    async with httpx.AsyncClient() as client:
        # Test currently-playing endpoint
        print("Testing /v1/me/player/currently-playing...")
        response = await client.get(
            "https://api.spotify.com/v1/me/player/currently-playing",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            print(f"Response: {response.json()}")
        else:
            print(f"Response text: {response.text}")
        
        print("\n" + "="*50 + "\n")
        
        # Test player endpoint (more info)
        print("Testing /v1/me/player...")
        response2 = await client.get(
            "https://api.spotify.com/v1/me/player",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        print(f"Status: {response2.status_code}")
        if response2.status_code == 200:
            data = response2.json()
            print(f"Device: {data.get('device', {}).get('name')}")
            print(f"Is Playing: {data.get('is_playing')}")
            if data.get('item'):
                print(f"Track: {data['item']['name']}")
                print(f"Artist: {data['item']['artists'][0]['name']}")
        else:
            print(f"Response text: {response2.text}")

asyncio.run(test_spotify())
