from fastapi import APIRouter, HTTPException
import httpx
import os
from dotenv import load_dotenv
from datetime import datetime

router = APIRouter()

# Load environment variables
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(CURRENT_DIR)
ENV_PATH = os.path.join(BACKEND_DIR, '.env')
load_dotenv(ENV_PATH)

OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY")

# City coordinates for weather lookup
CITIES = {
    "leamington_spa": {
        "name": "Leamington Spa",
        "lat": 52.2919,
        "lon": -1.5377,
        "timezone": "Europe/London"
    },
    "dublin": {
        "name": "Dublin",
        "lat": 53.3498,
        "lon": -6.2603,
        "timezone": "Europe/Dublin"
    }
}

@router.get("/current")
async def get_weather():
    """Get current weather for all configured cities."""
    if not OPENWEATHER_API_KEY:
        raise HTTPException(status_code=500, detail="OpenWeather API key not configured")
    
    weather_data = []
    
    async with httpx.AsyncClient() as client:
        for city_id, city_info in CITIES.items():
            try:
                # Get current weather
                url = f"https://api.openweathermap.org/data/2.5/weather"
                params = {
                    "lat": city_info["lat"],
                    "lon": city_info["lon"],
                    "appid": OPENWEATHER_API_KEY,
                    "units": "metric"
                }
                
                response = await client.get(url, params=params)
                
                if response.status_code == 200:
                    data = response.json()
                    
                    weather_data.append({
                        "city_id": city_id,
                        "city_name": city_info["name"],
                        "timezone": city_info["timezone"],
                        "temperature": round(data["main"]["temp"]),
                        "feels_like": round(data["main"]["feels_like"]),
                        "humidity": data["main"]["humidity"],
                        "description": data["weather"][0]["description"].title(),
                        "icon": data["weather"][0]["icon"],
                        "wind_speed": round(data["wind"]["speed"] * 3.6, 1),  # Convert m/s to km/h
                        "timestamp": datetime.utcnow().isoformat()
                    })
                else:
                    print(f"Failed to get weather for {city_info['name']}: {response.status_code}")
                    
            except Exception as e:
                print(f"Error fetching weather for {city_info['name']}: {e}")
    
    return {"cities": weather_data}

@router.get("/forecast")
async def get_forecast(city_id: str):
    """Get 5-day forecast for a specific city."""
    if not OPENWEATHER_API_KEY:
        raise HTTPException(status_code=500, detail="OpenWeather API key not configured")
    
    if city_id not in CITIES:
        raise HTTPException(status_code=404, detail="City not found")
    
    city_info = CITIES[city_id]
    
    async with httpx.AsyncClient() as client:
        try:
            url = f"https://api.openweathermap.org/data/2.5/forecast"
            params = {
                "lat": city_info["lat"],
                "lon": city_info["lon"],
                "appid": OPENWEATHER_API_KEY,
                "units": "metric"
            }
            
            response = await client.get(url, params=params)
            
            if response.status_code == 200:
                data = response.json()
                
                # Process forecast data (take every 8th item for daily forecast)
                forecasts = []
                for i in range(0, min(40, len(data["list"])), 8):
                    item = data["list"][i]
                    forecasts.append({
                        "date": item["dt_txt"],
                        "temperature": round(item["main"]["temp"]),
                        "description": item["weather"][0]["description"].title(),
                        "icon": item["weather"][0]["icon"]
                    })
                
                return {
                    "city_name": city_info["name"],
                    "forecasts": forecasts
                }
            else:
                raise HTTPException(status_code=response.status_code, detail="Failed to fetch forecast")
                
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
