from fastapi import APIRouter, HTTPException
from garminconnect import Garmin
import os
from dotenv import load_dotenv
from datetime import datetime, date, timedelta
import json

router = APIRouter()

# Load environment variables
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(CURRENT_DIR)
ENV_PATH = os.path.join(BACKEND_DIR, '.env')
load_dotenv(ENV_PATH)

GARMIN_EMAIL = os.getenv("GARMIN_EMAIL")
GARMIN_PASSWORD = os.getenv("GARMIN_PASSWORD")

# Token storage file
TOKEN_DIR = os.path.join(BACKEND_DIR, ".garmin_tokens")
os.makedirs(TOKEN_DIR, exist_ok=True)

# Simple in-memory cache
_cache = {}
CACHE_DURATION = timedelta(minutes=10)  # Cache for 10 minutes

def get_cached(key):
    """Get cached data if it exists and is not expired."""
    if key in _cache:
        data, timestamp = _cache[key]
        if datetime.now() - timestamp < CACHE_DURATION:
            return data
    return None

def set_cache(key, data):
    """Set cached data with current timestamp."""
    _cache[key] = (data, datetime.now())

def get_garmin_client():
    """Get authenticated Garmin client."""
    try:
        client = Garmin(GARMIN_EMAIL, GARMIN_PASSWORD)
        client.login()
        
        # Save session for future use
        client.garth.dump(TOKEN_DIR)
        
        return client
    except Exception as e:
        # Try to load saved session
        try:
            client = Garmin()
            client.garth.load(TOKEN_DIR)
            return client
        except:
            raise HTTPException(status_code=401, detail=f"Failed to authenticate with Garmin: {str(e)}")

@router.get("/stats")
async def get_stats():
    """Get today's activity stats."""
    cache_key = f"stats_{date.today().isoformat()}"
    
    # Check cache first
    cached_data = get_cached(cache_key)
    if cached_data:
        return cached_data
    
    try:
        client = get_garmin_client()
        
        # Get today's stats
        stats = client.get_stats(date.today().isoformat())
        
        print(f"Garmin stats response: {stats}")
        
        # Helper to safely convert None to 0
        def safe_value(val, default=0):
            return val if val is not None else default
        
        total_distance = stats.get("totalDistanceMeters")
        distance_km = round(total_distance / 1000, 2) if total_distance is not None else 0
        
        moderate_mins = safe_value(stats.get("moderateIntensityMinutes"))
        vigorous_mins = safe_value(stats.get("vigorousIntensityMinutes"))
        
        result = {
            "steps": safe_value(stats.get("totalSteps")),
            "calories": safe_value(stats.get("totalKilocalories")),
            "distance_km": distance_km,
            "active_minutes": moderate_mins + vigorous_mins,
            "floors": safe_value(stats.get("floorsAscended")),
            "resting_hr": stats.get("restingHeartRate"),
            "max_hr": stats.get("maxHeartRate"),
            "min_hr": stats.get("minHeartRate")
        }
        
        # Cache the result
        set_cache(cache_key, result)
        return result
    except Exception as e:
        print(f"Error fetching Garmin stats: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/sleep")
async def get_sleep(days: int = 7):
    """Get recent sleep data."""
    cache_key = f"sleep_{days}_{date.today().isoformat()}"
    
    # Check cache first
    cached_data = get_cached(cache_key)
    if cached_data:
        return cached_data
    
    try:
        client = get_garmin_client()
        
        sleep_history = []
        for i in range(days):
            check_date = date.today() - timedelta(days=i)
            try:
                sleep_data = client.get_sleep_data(check_date.isoformat())
                daily_sleep = sleep_data.get("dailySleepDTO", {})
                
                if daily_sleep.get("sleepTimeSeconds", 0) > 0:
                    sleep_history.append({
                        "date": check_date.isoformat(),
                        "total_sleep_seconds": daily_sleep.get("sleepTimeSeconds", 0),
                        "deep_sleep_seconds": daily_sleep.get("deepSleepSeconds", 0),
                        "light_sleep_seconds": daily_sleep.get("lightSleepSeconds", 0),
                        "rem_sleep_seconds": daily_sleep.get("remSleepSeconds", 0),
                        "awake_seconds": daily_sleep.get("awakeSleepSeconds", 0),
                        "sleep_score": daily_sleep.get("sleepScores", {}).get("overall", {}).get("value"),
                        "sleep_start": daily_sleep.get("sleepStartTimestampLocal"),
                        "sleep_end": daily_sleep.get("sleepEndTimestampLocal")
                    })
            except:
                continue
        
        # Cache the result
        set_cache(cache_key, sleep_history)
        return sleep_history
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/activities")
async def get_recent_activities(limit: int = 5):
    """Get recent activities."""
    cache_key = f"activities_{limit}_{date.today().isoformat()}"
    
    # Check cache first
    cached_data = get_cached(cache_key)
    if cached_data:
        return cached_data
    
    try:
        client = get_garmin_client()
        
        activities = client.get_activities(0, limit)
        
        result = []
        for activity in activities:
            result.append({
                "id": activity.get("activityId"),
                "name": activity.get("activityName"),
                "type": activity.get("activityType", {}).get("typeKey"),
                "start_time": activity.get("startTimeLocal"),
                "duration_seconds": activity.get("duration"),
                "distance_km": round(activity.get("distance", 0) / 1000, 2) if activity.get("distance") else None,
                "calories": activity.get("calories"),
                "avg_hr": activity.get("averageHR"),
                "max_hr": activity.get("maxHR")
            })
        
        # Cache the result
        set_cache(cache_key, result)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/heart-rate")
async def get_heart_rate():
    """Get current heart rate data."""
    try:
        client = get_garmin_client()
        
        hr_data = client.get_heart_rates(date.today().isoformat())
        
        # Get latest heart rate reading
        heart_rate_values = hr_data.get("heartRateValues", [])
        latest_hr = None
        if heart_rate_values:
            # Filter out None values and get the last one
            valid_hrs = [hr for hr in heart_rate_values if hr is not None]
            if valid_hrs:
                latest_hr = valid_hrs[-1]
        
        resting_hr = hr_data.get("restingHeartRate")
        
        return {
            "current": latest_hr,
            "resting": resting_hr,
            "max_today": hr_data.get("maxHeartRate"),
            "min_today": hr_data.get("minHeartRate")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/body")
async def get_body_metrics():
    """Get body metrics (weight, body battery, stress)."""
    cache_key = f"body_{date.today().isoformat()}"
    
    # Check cache first
    cached_data = get_cached(cache_key)
    if cached_data:
        return cached_data
    
    try:
        client = get_garmin_client()
        
        # Get body composition
        try:
            body_comp = client.get_body_composition(date.today().isoformat())
            weight = body_comp.get("weight")
        except:
            weight = None
        
        # Get stress data
        try:
            stress_data = client.get_stress_data(date.today().isoformat())
            avg_stress = stress_data.get("avgStressLevel")
            max_stress = stress_data.get("maxStressLevel")
        except:
            avg_stress = None
            max_stress = None
        
        result = {
            "weight_kg": weight / 1000 if weight else None,  # Convert grams to kg
            "avg_stress": avg_stress,
            "max_stress": max_stress
        }
        
        # Cache the result
        set_cache(cache_key, result)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
