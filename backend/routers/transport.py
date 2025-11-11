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

# Import user config utilities
from ..database import get_session, engine
from ..models import UserConfig
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

async def get_user_bus_config():
    """Get user's bus stop configuration from database."""
    async with AsyncSession(engine) as session:
        statement = select(UserConfig)
        result = await session.execute(statement)
        config = result.first()
        
        if config:
            config_obj = config[0]  # Extract the UserConfig object from tuple
            morning_stops = (config_obj.morning_bus_stops or "").split(",") if config_obj.morning_bus_stops else []
            evening_stops = (config_obj.evening_bus_stops or "").split(",") if config_obj.evening_bus_stops else []
            relevant_routes = (config_obj.relevant_routes or "").lower().split(",") if config_obj.relevant_routes else []
            return {
                "morning_stops": [s.strip() for s in morning_stops if s.strip()],
                "evening_stops": [s.strip() for s in evening_stops if s.strip()],
                "relevant_routes": [r.strip() for r in relevant_routes if r.strip()]
            }
    
    # Fallback to env variables
    return {
        "morning_stops": [s.strip() for s in (os.getenv("MORNING_STOPS") or "").split(",") if s.strip()],
        "evening_stops": [s.strip() for s in (os.getenv("EVENING_STOPS") or "").split(",") if s.strip()],
        "relevant_routes": [r.strip() for r in (os.getenv("RELEVANT_ROUTES") or "").lower().split(",") if os.getenv("RELEVANT_ROUTES") and r.strip()]
    }

# Cache configuration
CACHE_DURATION = 60  # seconds
CACHE = {"data": None, "last_updated": 0}
BUS_LOCATIONS_CACHE = {"data": None, "last_updated": 0}
# ---------------------

async def fetch_bus_service_timetables(client: httpx.AsyncClient, operator: str, line: str, direction: str = None) -> dict:
    """Fetch bus service timetables with real-time vehicle positions from TransportAPI."""
    url = f"https://transportapi.com/v3/uk/bus/service_timetables/{operator}/{line}.json"
    params = {
        "app_id": APP_ID,
        "app_key": APP_KEY,
        "vehicle_positions": "true",  # Enable real-time vehicle positions
        "edge_geometry": "true",
        "stops": "true"
    }
    if direction:
        params["direction"] = direction
    
    try:
        response = await client.get(url, params=params)
        if response.status_code == 200:
            return response.json()
    except Exception as e:
        print(f"Error fetching bus service timetable {operator}/{line}: {e}")
    return {}

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

def process_results(all_buses_raw: list, relevant_routes: list) -> list:
    """Filter and format bus departure data."""
    filtered = []
    for bus in all_buses_raw:
        # Filter by relevant routes if configured
        if relevant_routes and str(bus.get("line_name")).lower() not in relevant_routes:
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

    # Get user config
    config = await get_user_bus_config()
    morning_stops = config["morning_stops"]
    evening_stops = config["evening_stops"]
    relevant_routes = config["relevant_routes"]
    
    if not morning_stops and not evening_stops:
        return {"workbound": [], "homebound": []}

    # Fetch fresh data from TransportAPI
    async with httpx.AsyncClient(follow_redirects=True) as client:
        morning_results = await asyncio.gather(*[fetch_tapi_data(client, stop) for stop in morning_stops])
        evening_results = await asyncio.gather(*[fetch_tapi_data(client, stop) for stop in evening_stops])

        fresh_data = {
            "workbound": process_results([b for sub in morning_results for b in sub], relevant_routes),
            "homebound": process_results([b for sub in evening_results for b in sub], relevant_routes)
        }
        
        CACHE["data"] = fresh_data
        CACHE["last_updated"] = current_time
        return fresh_data

@router.get("/bus/stops/debug/{atco_code}")
async def debug_bus_stop(atco_code: str):
    """Debug endpoint to see raw TransportAPI data for a stop."""
    if not APP_ID or not APP_KEY:
        return {"error": "TransportAPI credentials not configured"}
    
    url = f"https://transportapi.com/v3/uk/bus/stop/{atco_code}/live.json"
    params = {
        "app_id": APP_ID,
        "app_key": APP_KEY,
        "group": "no",
        "nextbuses": "yes"
    }
    
    try:
        async with httpx.AsyncClient(follow_redirects=True) as client:
            response = await client.get(url, params=params)
            print(f"Debug stop {atco_code}: Status {response.status_code}")
            if response.status_code == 200:
                return response.json()
            else:
                return {"error": f"API returned {response.status_code}", "details": response.text}
    except Exception as e:
        return {"error": str(e)}

@router.get("/bus/stops/search")
async def search_bus_stops(lat: float, lon: float, radius: int = 500):
    """Search for bus stops near a location using TransportAPI."""
    url = "https://transportapi.com/v3/uk/bus/stops/near.json"
    params = {
        "app_id": APP_ID,
        "app_key": APP_KEY,
        "lat": lat,
        "lon": lon,
        "radius": radius,
        "page": 1,
        "rpp": 25
    }
    
    try:
        async with httpx.AsyncClient(follow_redirects=True) as client:
            response = await client.get(url, params=params)
            if response.status_code == 200:
                data = response.json()
                stops = []
                for stop in data.get("stops", []):
                    stops.append({
                        "atco_code": stop.get("atcocode"),
                        "name": stop.get("name"),
                        "latitude": float(stop.get("latitude", 0)),
                        "longitude": float(stop.get("longitude", 0)),
                        "indicator": stop.get("indicator", ""),
                        "locality": stop.get("locality_name", ""),
                        "distance": stop.get("distance", 0)
                    })
                return {"stops": stops, "count": len(stops)}
    except Exception as e:
        print(f"Error searching bus stops: {e}")
        return {"stops": [], "count": 0, "error": str(e)}

@router.get("/bus/stops")
async def get_bus_stops():
    """Get information about configured bus stops including coordinates."""
    # Get user config to get the configured stop codes
    config = await get_user_bus_config()
    morning_stops = config["morning_stops"]
    evening_stops = config["evening_stops"]
    all_stop_codes = list(set(morning_stops + evening_stops))
    
    print(f"[DEBUG] Bus stops - morning: {morning_stops}, evening: {evening_stops}, all: {all_stop_codes}")
    
    if not all_stop_codes:
        return {"stops": []}
    
    # Fetch details for each configured stop
    stops_info = []
    async with httpx.AsyncClient(follow_redirects=True, timeout=10.0) as client:
        for atco_code in all_stop_codes:
            try:
                # Use /live.json endpoint which includes stop metadata
                url = f"https://transportapi.com/v3/uk/bus/stop/{atco_code}/live.json"
                params = {
                    "app_id": APP_ID, 
                    "app_key": APP_KEY,
                    "group": "no"
                }
                print(f"[DEBUG] Fetching stop {atco_code} from {url}")
                response = await client.get(url, params=params)
                print(f"[DEBUG] Response status: {response.status_code}")
                
                if response.status_code == 200:
                    stop_data = response.json()
                    stop_type = 'morning' if atco_code in morning_stops else 'evening'
                    
                    # Hardcoded coordinates for known stops (TransportAPI doesn't provide them in live endpoint)
                    # TODO: Store these in database when stops are configured
                    stop_coords = {
                        "4200F225601": (52.29238, -1.53576)  # Upper Parade Stand K
                    }
                    lat, lon = stop_coords.get(atco_code, (0.0, 0.0))
                    
                    stops_info.append({
                        "atco_code": atco_code,
                        "name": stop_data.get("name", "Unknown"),
                        "latitude": lat,
                        "longitude": lon,
                        "indicator": stop_data.get("indicator", ""),
                        "locality": stop_data.get("locality_name", ""),
                        "type": stop_type
                    })
                    # print(f"[DEBUG] Added stop: {stop_data.get('name')} at ({lat}, {lon})")  # Commented to reduce log noise
            except Exception as e:
                print(f"Error fetching stop {atco_code}: {e}")
    
    return {"stops": stops_info}

@router.get("/bus/routes")
async def get_bus_routes():
    """Get actual bus route geometries from TransportAPI for configured services.
    Falls back to approximate routes if API is unavailable."""
    
    # Fallback approximate routes (Leamington Spa to Warwick University area)
    fallback_routes = {
        "U1": {
            "route": "U1",
            "operator": "SCNH",
            "coordinates": [
                [52.2892, -1.5373], [52.2916, -1.5389], [52.3000, -1.5450],
                [52.3200, -1.5500], [52.3500, -1.5550], [52.3809, -1.5617]
            ]
        },
        "U2": {
            "route": "U2",
            "operator": "SCNH",
            "coordinates": [
                [52.2892, -1.5373], [52.2916, -1.5389], [52.3000, -1.5420],
                [52.3250, -1.5480], [52.3550, -1.5530], [52.3809, -1.5617]
            ]
        },
        "11": {
            "route": "11",
            "operator": "SCNH",
            "coordinates": [
                [52.2892, -1.5373], [52.2950, -1.5400], [52.3100, -1.5500],
                [52.3471, -1.5667], [52.3600, -1.5650], [52.3750, -1.5600], [52.3809, -1.5617]
            ]
        }
    }
    
    # Route configuration: operator code and direction for each route
    # Note: Some routes may not have direction-specific services
    route_config = {
        "U1": {"operator": "SCNH", "line_name": "U1", "direction": "outbound"},
        "U2": {"operator": "SCNH", "line_name": "U2", "direction": "outbound"},  # U2 might be circular or no direction
        "11": {"operator": "SCNH", "line_name": "11", "direction": "outbound"}
    }
    
    if not APP_ID or not APP_KEY:
        # Return fallback routes if no API credentials
        return {"routes": list(fallback_routes.values()), "source": "fallback"}
    
    # Get user config for relevant routes
    config = await get_user_bus_config()
    relevant_routes = config["relevant_routes"]
    
    if not relevant_routes:
        return {"routes": []}
    
    routes_data = []
    
    async with httpx.AsyncClient(follow_redirects=True, timeout=15.0) as client:
        # For each relevant route, fetch the timetable with edge geometry
        for route in relevant_routes[:3]:  # Limit to 3 to avoid quota issues
            try:
                route_upper = route.upper()
                route_info = route_config.get(route_upper)
                
                if not route_info:
                    print(f"[DEBUG] No config found for route {route}, using fallback")
                    if route_upper in fallback_routes:
                        routes_data.append(fallback_routes[route_upper])
                    continue
                
                # Use the /bus/route endpoint with edge_geometry
                # Format: /bus/route/{operator}/{route}/{direction}/timetable.json
                timetable_url = f"https://transportapi.com/v3/uk/bus/route/{route_info['operator']}/{route_upper}/{route_info['direction']}/timetable.json"
                params = {
                    "app_id": APP_ID,
                    "app_key": APP_KEY,
                    "edge_geometry": "true"
                }
                
                print(f"[DEBUG] Fetching route geometry for {route} from {timetable_url}")
                response = await client.get(timetable_url, params=params)
                print(f"[DEBUG] Response status: {response.status_code}")
                
                if response.status_code == 200:
                    data = response.json()
                    stops = data.get("stops", [])
                    print(f"[DEBUG] Found {len(stops)} stops for {route}")
                    
                    if stops and len(stops) > 1:
                        # Extract geometry from stop connections
                        # The coordinates are in stops[].next.coordinates as arrays of [lon, lat]
                        geometries = []
                        for stop in stops[:-1]:  # All stops except the last (which has no 'next')
                            if "next" in stop and "coordinates" in stop["next"]:
                                # Each stop's 'next' contains coordinates to the next stop
                                coords = stop["next"]["coordinates"]
                                if coords:
                                    geometries.append({
                                        "type": "LineString",
                                        "coordinates": coords
                                    })
                        
                        if geometries:
                            routes_data.append({
                                "route": route_upper,
                                "operator": route_info["operator"],
                                "geometries": geometries,
                                "description": f"{route_upper} to {stops[-1].get('name', 'Destination')}"
                            })
                            print(f"[DEBUG] Found {len(geometries)} geometry segments for {route}")
                        else:
                            print(f"[DEBUG] No geometries found in stop connections for {route}")
                            # Use fallback
                            if route_upper in fallback_routes:
                                routes_data.append(fallback_routes[route_upper])
                                print(f"[DEBUG] Using fallback route for {route}")
                    else:
                        print(f"[DEBUG] No stops found for route {route}")
                        # Use fallback
                        if route_upper in fallback_routes:
                            routes_data.append(fallback_routes[route_upper])
                            print(f"[DEBUG] Using fallback route for {route}")
                elif response.status_code == 404:
                    # Route not found - U2 might not have direction-specific service or might use different naming
                    print(f"[DEBUG] 404 for {route} with direction {route_info['direction']}")
                    print(f"[DEBUG] This route may not exist in TransportAPI or uses different naming")
                    # Use hardcoded fallback immediately
                    if route_upper in fallback_routes:
                        routes_data.append(fallback_routes[route_upper])
                        print(f"[DEBUG] Using hardcoded fallback route for {route}")
                else:
                    print(f"[DEBUG] API error {response.status_code}: {response.text[:200]}")
                    # Use fallback for this route if API fails
                    route_upper = route.upper()
                    if route_upper in fallback_routes:
                        fallback = fallback_routes[route_upper]
                        routes_data.append({
                            "route": fallback["route"],
                            "operator": fallback["operator"],
                            "coordinates": fallback["coordinates"],
                            "source": "fallback"
                        })
                        print(f"[DEBUG] Using hardcoded fallback route for {route}")
                
            except Exception as e:
                print(f"[DEBUG] Exception fetching route {route}: {e}")
                # Use fallback on exception
                route_upper = route.upper()
                if route_upper in fallback_routes:
                    fallback = fallback_routes[route_upper]
                    routes_data.append({
                        "route": fallback["route"],
                        "operator": fallback["operator"],
                        "coordinates": fallback["coordinates"],
                        "source": "fallback"
                    })
    
    return {"routes": routes_data, "source": "mixed" if routes_data else "none"}
    
    # REAL API CODE (commented out to save credits):
    # stops_info = []
    # 
    # async with httpx.AsyncClient(follow_redirects=True) as client:
    #     all_stops = list(set(MORNING_STOPS + EVENING_STOPS))
    #     
    #     for atco_code in all_stops:
    #         url = f"https://transportapi.com/v3/uk/bus/stop/{atco_code}.json"
    #         params = {
    #             "app_id": APP_ID,
    #             "app_key": APP_KEY
    #         }
    #         try:
    #             response = await client.get(url, params=params)
    #             if response.status_code == 200:
    #                 data = response.json()
    #                 stops_info.append({
    #                     "atco_code": atco_code,
    #                     "name": data.get("name", "Unknown"),
    #                     "latitude": float(data.get("latitude", 0)),
    #                     "longitude": float(data.get("longitude", 0)),
    #                     "indicator": data.get("indicator", ""),
    #                     "locality": data.get("locality_name", ""),
    #                     "type": "morning" if atco_code in MORNING_STOPS else "evening"
    #                 })
    #         except Exception as e:
    #             print(f"Error fetching stop {atco_code}: {e}")
    # 
    # return {"stops": stops_info}

@router.get("/bus/locations")
async def get_bus_locations(force: bool = False):
    """Get real-time locations of buses on relevant routes."""
    current_time = time.time()
    
    # Return cached data if still fresh
    if not force and BUS_LOCATIONS_CACHE["data"] and (current_time - BUS_LOCATIONS_CACHE["last_updated"] < CACHE_DURATION):
        return BUS_LOCATIONS_CACHE["data"]
    
    # Get user config
    config = await get_user_bus_config()
    morning_stops = config["morning_stops"]
    evening_stops = config["evening_stops"]
    relevant_routes = config["relevant_routes"]
    
    if not morning_stops and not evening_stops:
        return {"locations": []}
    
    bus_locations = []
    
    async with httpx.AsyncClient(follow_redirects=True) as client:
        # Fetch current departures to get operators and line names
        all_stops = list(set(morning_stops + evening_stops))
        departures = []
        
        for atco_code in all_stops:
            buses = await fetch_tapi_data(client, atco_code)
            departures.extend(buses)
        
        # Extract unique operator/line combinations for relevant routes
        services = set()
        for bus in departures:
            line_name = str(bus.get("line_name", "")).lower()
            if relevant_routes and line_name in relevant_routes:
                operator = bus.get("operator", "")
                if operator and line_name:
                    services.add((operator, bus.get("line_name"), bus.get("direction", "")))
        
        # Fetch vehicle locations for each service
        for operator, line, direction in list(services)[:5]:  # Limit to 5 services to avoid rate limits
            service_data = await fetch_bus_service_timetables(client, operator, line, direction)
            
            # Extract vehicle positions from timetable data
            if "timetables" in service_data:
                for timetable in service_data["timetables"]:
                    if "vehicle_positions" in timetable:
                        for vehicle in timetable["vehicle_positions"]:
                            if "latitude" in vehicle and "longitude" in vehicle:
                                bus_locations.append({
                                    "operator": operator,
                                    "route": line,
                                    "latitude": float(vehicle.get("latitude", 0)),
                                    "longitude": float(vehicle.get("longitude", 0)),
                                    "bearing": vehicle.get("bearing"),
                                    "destination": timetable.get("destination", ""),
                                    "last_updated": vehicle.get("recorded_at_time", "")
                                })
    
    result = {"locations": bus_locations}
    BUS_LOCATIONS_CACHE["data"] = result
    BUS_LOCATIONS_CACHE["last_updated"] = current_time
    
    return result