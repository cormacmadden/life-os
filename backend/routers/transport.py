from fastapi import APIRouter
import httpx
import asyncio
import time
import os
from dotenv import load_dotenv

router = APIRouter()

# Load environment variables
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(CURRENT_DIR)
ENV_PATH = os.path.join(BACKEND_DIR, '.env')
load_dotenv(ENV_PATH)

APP_ID = os.getenv("TRANSPORT_APP_ID")
APP_KEY = os.getenv("TRANSPORT_APP_KEY")
MORNING_STOPS = (os.getenv("MORNING_STOPS") or "").split(",")
EVENING_STOPS = (os.getenv("EVENING_STOPS") or "").split(",")
RELEVANT_ROUTES = (os.getenv("RELEVANT_ROUTES") or "").lower().split(",") if os.getenv("RELEVANT_ROUTES") else []

# Cache configuration
CACHE_DURATION = 60  # seconds
CACHE = {"data": None, "last_updated": 0}
# ---------------------

async def fetch_tapi_data(client: httpx.AsyncClient, atco_code: str) -> list:
    """Fetch live bus data from TransportAPI for a given stop."""
    url = f"https://transportapi.com/v3/uk/bus/stop/{atco_code}/live.json"
    params = {
        "app_id": APP_ID,
        "app_key": APP_KEY,
        "group": "no",
        "nextbuses": "yes",
        "limit": 10
    }
    try:
        response = await client.get(url, params=params)
        if response.status_code == 200:
            return response.json().get("departures", {}).get("all", [])
    except Exception:
        pass
    return []

def process_results(all_buses_raw: list) -> list:
    """Filter and format bus departure data."""
    filtered = []
    for bus in all_buses_raw:
        # Filter by relevant routes if configured
        if RELEVANT_ROUTES and str(bus.get("line_name")).lower() not in RELEVANT_ROUTES:
            continue
        
        aimed = bus.get("aimed_departure_time")
        expected = bus.get("expected_departure_time")
        status = "Late" if expected and aimed and expected > aimed else "On time"
        
        filtered.append({
            "route": bus.get("line_name"),
            "destination": bus.get("direction") or bus.get("operator_name"),
            "due": bus.get("best_departure_estimate", aimed),
            "status": status,
            "_sort_time": expected or aimed
        })
    
    filtered.sort(key=lambda x: x["_sort_time"] if x["_sort_time"] else "99:99")
    return filtered[:5]

@router.get("/bus")
async def get_bus_times(force: bool = False):
    """Get live bus times for morning and evening commute."""
    current_time = time.time()
    
    # Return cached data if still fresh
    if not force and CACHE["data"] and (current_time - CACHE["last_updated"] < CACHE_DURATION):
        return CACHE["data"]

    # Fetch fresh data from TransportAPI
    async with httpx.AsyncClient(follow_redirects=True) as client:
        morning_results = await asyncio.gather(*[fetch_tapi_data(client, stop) for stop in MORNING_STOPS])
        evening_results = await asyncio.gather(*[fetch_tapi_data(client, stop) for stop in EVENING_STOPS])

        fresh_data = {
            "workbound": process_results([b for sub in morning_results for b in sub]),
            "homebound": process_results([b for sub in evening_results for b in sub])
        }
        
        CACHE["data"] = fresh_data
        CACHE["last_updated"] = current_time
        return fresh_data