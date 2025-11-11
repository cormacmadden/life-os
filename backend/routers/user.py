from fastapi import APIRouter, HTTPException
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from ..database import engine
from ..models import UserConfig
from pydantic import BaseModel
from typing import Optional
import httpx
import os

router = APIRouter()

async def geocode_with_nominatim(address: str) -> tuple[Optional[float], Optional[float]]:
    """Geocode using OpenStreetMap Nominatim (free, no API key required)."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://nominatim.openstreetmap.org/search",
                params={
                    "q": address,
                    "format": "json",
                    "limit": 1,
                    "addressdetails": 1
                },
                headers={
                    "User-Agent": "LifeOS/1.0 (contact: lifeos@example.com)"
                },
                timeout=15.0
            )
            
            if response.status_code == 200:
                data = response.json()
                if data and len(data) > 0:
                    lat = float(data[0]["lat"])
                    lon = float(data[0]["lon"])
                    print(f"✓ Nominatim geocoded '{address}' to ({lat}, {lon})")
                    return lat, lon
                else:
                    print(f"⚠ Nominatim: No results for '{address}'")
            else:
                print(f"⚠ Nominatim returned status {response.status_code}")
    except Exception as e:
        print(f"⚠ Nominatim error for '{address}': {e}")
    
    return None, None

async def geocode_with_google(address: str) -> tuple[Optional[float], Optional[float]]:
    """Geocode using Google Geocoding API (requires API key)."""
    api_key = os.getenv("GOOGLE_GEOCODING_API_KEY")
    if not api_key:
        return None, None
    
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
            
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "OK" and data.get("results"):
                    location = data["results"][0]["geometry"]["location"]
                    lat = location["lat"]
                    lon = location["lng"]
                    print(f"✓ Google geocoded '{address}' to ({lat}, {lon})")
                    return lat, lon
                else:
                    print(f"⚠ Google Geocoding status: {data.get('status')}")
    except Exception as e:
        print(f"⚠ Google Geocoding error for '{address}': {e}")
    
    return None, None

async def geocode_with_positionstack(address: str) -> tuple[Optional[float], Optional[float]]:
    """Geocode using Positionstack API (requires API key, free tier available)."""
    api_key = os.getenv("POSITIONSTACK_API_KEY")
    if not api_key:
        return None, None
    
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
            
            if response.status_code == 200:
                data = response.json()
                if data.get("data") and len(data["data"]) > 0:
                    result = data["data"][0]
                    lat = result["latitude"]
                    lon = result["longitude"]
                    print(f"✓ Positionstack geocoded '{address}' to ({lat}, {lon})")
                    return lat, lon
                else:
                    print(f"⚠ Positionstack: No results for '{address}'")
    except Exception as e:
        print(f"⚠ Positionstack error for '{address}': {e}")
    
    return None, None

async def geocode_address(address: str) -> tuple[Optional[float], Optional[float]]:
    """
    Convert an address to latitude/longitude with multiple provider fallbacks.
    
    Priority order:
    1. Google Geocoding (if API key available) - most accurate
    2. Nominatim (OpenStreetMap) - free, no API key
    3. Positionstack (if API key available) - backup
    """
    if not address or address.strip() == "":
        return None, None
    
    address = address.strip()
    print(f"\n🌍 Attempting to geocode: '{address}'")
    
    # Try Google first if API key is available
    lat, lon = await geocode_with_google(address)
    if lat is not None and lon is not None:
        return lat, lon
    
    # Try Nominatim (always available)
    lat, lon = await geocode_with_nominatim(address)
    if lat is not None and lon is not None:
        return lat, lon
    
    # Try Positionstack as last resort
    lat, lon = await geocode_with_positionstack(address)
    if lat is not None and lon is not None:
        return lat, lon
    
    print(f"✗ All geocoding providers failed for '{address}'")
    return None, None

class UserConfigUpdate(BaseModel):
    morning_bus_stops: Optional[str] = None
    evening_bus_stops: Optional[str] = None
    relevant_routes: Optional[str] = None
    home_address: Optional[str] = None
    home_latitude: Optional[float] = None
    home_longitude: Optional[float] = None
    work_address: Optional[str] = None
    work_latitude: Optional[float] = None
    work_longitude: Optional[float] = None

@router.get("/config")
async def get_user_config():
    """Get user configuration"""
    async with AsyncSession(engine) as session:
        result = await session.execute(
            select(UserConfig).where(UserConfig.user_id == 1)
        )
        config = result.scalar_one_or_none()
        
        if not config:
            # Return default empty config
            return {
                "morning_bus_stops": "",
                "evening_bus_stops": "",
                "relevant_routes": "",
                "home_address": "",
                "home_latitude": None,
                "home_longitude": None,
                "work_address": "",
                "work_latitude": None,
                "work_longitude": None
            }
        
        return {
            "morning_bus_stops": config.morning_bus_stops or "",
            "evening_bus_stops": config.evening_bus_stops or "",
            "relevant_routes": config.relevant_routes or "",
            "home_address": config.home_address or "",
            "home_latitude": config.home_latitude,
            "home_longitude": config.home_longitude,
            "work_address": config.work_address or "",
            "work_latitude": config.work_latitude,
            "work_longitude": config.work_longitude
        }

@router.put("/config")
async def update_user_config(config_data: UserConfigUpdate):
    """Update user configuration with automatic geocoding of addresses"""
    try:
        async with AsyncSession(engine, expire_on_commit=False) as session:
            # Query for existing config
            result = await session.execute(
                select(UserConfig).where(UserConfig.user_id == 1)
            )
            config = result.scalar_one_or_none()
            
            # Geocode addresses if provided (with timeout protection)
            home_lat, home_lng = None, None
            work_lat, work_lng = None, None
            
            try:
                if config_data.home_address and config_data.home_address.strip():
                    try:
                        home_lat, home_lng = await geocode_address(config_data.home_address)
                        print(f"✓ Geocoded home address '{config_data.home_address}' to: {home_lat}, {home_lng}")
                    except Exception as e:
                        print(f"⚠ Failed to geocode home address: {e}")
                
                if config_data.work_address and config_data.work_address.strip():
                    try:
                        work_lat, work_lng = await geocode_address(config_data.work_address)
                        print(f"✓ Geocoded work address '{config_data.work_address}' to: {work_lat}, {work_lng}")
                    except Exception as e:
                        print(f"⚠ Failed to geocode work address: {e}")
            except Exception as e:
                print(f"⚠ Geocoding error (continuing without coordinates): {e}")
            
            if not config:
                # Create new config
                config = UserConfig(
                    user_id=1,
                    morning_bus_stops=config_data.morning_bus_stops,
                    evening_bus_stops=config_data.evening_bus_stops,
                    relevant_routes=config_data.relevant_routes,
                    home_address=config_data.home_address,
                    home_latitude=home_lat,
                    home_longitude=home_lng,
                    work_address=config_data.work_address,
                    work_latitude=work_lat,
                    work_longitude=work_lng
                )
                session.add(config)
                await session.commit()
                await session.refresh(config)
            else:
                # Update existing config (config is already in session from query)
                if config_data.morning_bus_stops is not None:
                    config.morning_bus_stops = config_data.morning_bus_stops
                if config_data.evening_bus_stops is not None:
                    config.evening_bus_stops = config_data.evening_bus_stops
                if config_data.relevant_routes is not None:
                    config.relevant_routes = config_data.relevant_routes
                if config_data.home_address is not None:
                    config.home_address = config_data.home_address
                    config.home_latitude = home_lat
                    config.home_longitude = home_lng
                if config_data.work_address is not None:
                    config.work_address = config_data.work_address
                    config.work_latitude = work_lat
                    config.work_longitude = work_lng
                
                await session.commit()
                await session.refresh(config)
            
            # Build response while still in session context
            return {
                "message": "Configuration updated successfully",
                "config": {
                    "morning_bus_stops": config.morning_bus_stops or "",
                    "evening_bus_stops": config.evening_bus_stops or "",
                    "relevant_routes": config.relevant_routes or "",
                    "home_address": config.home_address or "",
                    "home_latitude": config.home_latitude,
                    "home_longitude": config.home_longitude,
                    "work_address": config.work_address or "",
                    "work_latitude": config.work_latitude,
                    "work_longitude": config.work_longitude
                }
            }
    except Exception as e:
        print(f"Error updating user config: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update configuration: {str(e)}")

@router.get("/geocode")
async def test_geocode(address: str):
    """
    Test geocoding endpoint to verify address resolution.
    Example: GET /api/user/geocode?address=Birmingham,UK
    """
    if not address:
        raise HTTPException(status_code=400, detail="Address parameter is required")
    
    lat, lon = await geocode_address(address)
    
    if lat is None or lon is None:
        return {
            "success": False,
            "address": address,
            "message": "Could not geocode this address. Try being more specific (e.g., add country)."
        }
    
    return {
        "success": True,
        "address": address,
        "latitude": lat,
        "longitude": lon,
        "coordinates": f"({lat}, {lon})"
    }
