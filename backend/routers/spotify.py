from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import RedirectResponse
import httpx
import os
from dotenv import load_dotenv
import base64
from datetime import datetime, timedelta
from typing import Optional

router = APIRouter()

# Load environment variables
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(CURRENT_DIR)
ENV_PATH = os.path.join(BACKEND_DIR, '.env')
load_dotenv(ENV_PATH)

SPOTIFY_CLIENT_ID = os.getenv("SPOTIFY_CLIENT_ID")
SPOTIFY_CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET")
SPOTIFY_REDIRECT_URI = os.getenv("SPOTIFY_REDIRECT_URI", "http://localhost:8000/api/spotify/callback")

# Token storage file
TOKEN_FILE = os.path.join(BACKEND_DIR, "spotify_tokens.json")

def load_tokens():
    """Load tokens from file."""
    if os.path.exists(TOKEN_FILE):
        try:
            import json
            with open(TOKEN_FILE, 'r') as f:
                data = json.load(f)
                if data.get("expires_at"):
                    data["expires_at"] = datetime.fromisoformat(data["expires_at"])
                return data
        except Exception as e:
            print(f"Error loading tokens: {e}")
    return {
        "access_token": None,
        "refresh_token": None,
        "expires_at": None
    }

def save_tokens():
    """Save tokens to file."""
    try:
        import json
        data = spotify_tokens.copy()
        if data.get("expires_at"):
            data["expires_at"] = data["expires_at"].isoformat()
        with open(TOKEN_FILE, 'w') as f:
            json.dump(data, f)
    except Exception as e:
        print(f"Error saving tokens: {e}")

# Token storage (persisted to file)
spotify_tokens = load_tokens()

def get_auth_header() -> str:
    """Generate Basic Auth header for Spotify API."""
    auth_string = f"{SPOTIFY_CLIENT_ID}:{SPOTIFY_CLIENT_SECRET}"
    auth_bytes = auth_string.encode("utf-8")
    auth_base64 = base64.b64encode(auth_bytes).decode("utf-8")
    return f"Basic {auth_base64}"

async def refresh_access_token() -> bool:
    """Refresh the Spotify access token using the refresh token."""
    if not spotify_tokens["refresh_token"]:
        return False
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                "https://accounts.spotify.com/api/token",
                headers={
                    "Authorization": get_auth_header(),
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                data={
                    "grant_type": "refresh_token",
                    "refresh_token": spotify_tokens["refresh_token"]
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                spotify_tokens["access_token"] = data["access_token"]
                spotify_tokens["expires_at"] = datetime.now() + timedelta(seconds=data["expires_in"])
                save_tokens()
                return True
        except Exception as e:
            print(f"Error refreshing Spotify token: {e}")
    
    return False

async def get_valid_token() -> Optional[str]:
    """Get a valid access token, refreshing if necessary."""
    if not spotify_tokens["access_token"]:
        return None
    
    # Check if token is expired or about to expire
    if spotify_tokens["expires_at"] and datetime.now() >= spotify_tokens["expires_at"] - timedelta(minutes=5):
        if await refresh_access_token():
            return spotify_tokens["access_token"]
        return None
    
    return spotify_tokens["access_token"]

@router.get("/auth")
async def spotify_auth():
    """Initiate Spotify OAuth flow."""
    if not SPOTIFY_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Spotify client ID not configured")
    
    scope = "user-read-currently-playing user-read-playback-state user-modify-playback-state user-read-recently-played user-read-playback-position"
    auth_url = (
        f"https://accounts.spotify.com/authorize?"
        f"client_id={SPOTIFY_CLIENT_ID}&"
        f"response_type=code&"
        f"redirect_uri={SPOTIFY_REDIRECT_URI}&"
        f"scope={scope}"
    )
    
    return {"auth_url": auth_url}

@router.get("/callback")
async def spotify_callback(code: str):
    """Handle Spotify OAuth callback."""
    if not code:
        raise HTTPException(status_code=400, detail="No authorization code provided")
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                "https://accounts.spotify.com/api/token",
                headers={
                    "Authorization": get_auth_header(),
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": SPOTIFY_REDIRECT_URI
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                spotify_tokens["access_token"] = data["access_token"]
                spotify_tokens["refresh_token"] = data["refresh_token"]
                spotify_tokens["expires_at"] = datetime.now() + timedelta(seconds=data["expires_in"])
                save_tokens()
                print(f"Tokens saved successfully")
                
                # Redirect to frontend
                return RedirectResponse(url="http://localhost:3000?spotify=connected")
            else:
                raise HTTPException(status_code=response.status_code, detail="Failed to get access token")
                
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error during callback: {str(e)}")

@router.get("/token-status")
async def token_status():
    """Debug endpoint to check token status."""
    return {
        "has_access_token": bool(spotify_tokens["access_token"]),
        "has_refresh_token": bool(spotify_tokens["refresh_token"]),
        "expires_at": spotify_tokens["expires_at"].isoformat() if spotify_tokens["expires_at"] else None
    }

@router.get("/current-track")
async def get_current_track():
    """Get currently playing track."""
    token = await get_valid_token()
    
    if not token:
        # print("No valid token found")  # Commented to reduce log noise
        return {
            "authenticated": False,
            "playing": False
        }
    
    async with httpx.AsyncClient() as client:
        try:
            # Try the full player endpoint first for better info
            response = await client.get(
                "https://api.spotify.com/v1/me/player",
                headers={"Authorization": f"Bearer {token}"}
            )
            
            # print(f"Spotify /me/player Response Status: {response.status_code}")  # Commented to reduce log noise
            
            if response.status_code == 204:
                # No active device
                return {
                    "authenticated": True,
                    "playing": False,
                    "message": "No active Spotify device found. Please open Spotify and start playing something."
                }
            
            if response.status_code == 200:
                data = response.json()
                currently_playing_type = data.get("currently_playing_type", "track")
                
                # For episodes/podcasts, use currently-playing endpoint instead
                if currently_playing_type == "episode" or not data.get("item"):
                    # print(f"Detected episode/podcast, fetching from currently-playing endpoint")  # Commented to reduce log noise
                    # Try the currently-playing endpoint for episodes
                    response2 = await client.get(
                        "https://api.spotify.com/v1/me/player/currently-playing",
                        headers={"Authorization": f"Bearer {token}"}
                    )
                    
                    # print(f"Currently-playing response status: {response2.status_code}")  # Commented to reduce log noise
                    
                    if response2.status_code == 200:
                        episode_data = response2.json()
                        if episode_data and episode_data.get("item"):
                            item = episode_data["item"]
                            progress_ms = episode_data.get("progress_ms", 0)
                            duration_ms = item.get("duration_ms", 1)
                            
                            # Get album art from show or episode
                            album_art = None
                            if item.get("images") and len(item["images"]) > 0:
                                album_art = item["images"][0].get("url")
                            elif item.get("show", {}).get("images") and len(item["show"]["images"]) > 0:
                                album_art = item["show"]["images"][0].get("url")
                            
                            return {
                                "authenticated": True,
                                "playing": episode_data.get("is_playing", False),
                                "track": item.get("name", "Unknown Episode"),
                                "artist": item.get("show", {}).get("name", "Unknown Podcast"),
                                "album": "Podcast",
                                "album_art": album_art,
                                "progress": int((progress_ms / duration_ms) * 100) if duration_ms > 0 else 0,
                                "duration_ms": duration_ms,
                                "progress_ms": progress_ms
                            }
                        else:
                            # Spotify isn't returning episode details - show generic message
                            # print("Spotify API returned null item for episode")  # Commented to reduce log noise
                            return {
                                "authenticated": True,
                                "playing": data.get("is_playing", False),
                                "track": "Podcast Episode",
                                "artist": "Spotify Podcast",
                                "album": "Podcast",
                                "progress": 0
                            }
                    
                    # Fallback if currently-playing also fails
                    return {
                        "authenticated": True,
                        "playing": data.get("is_playing", False),
                        "track": "Podcast Episode",
                        "artist": "Spotify Podcast",
                        "album": "Podcast"
                    }
                
                track = data["item"]
                progress_ms = data.get("progress_ms", 0)
                duration_ms = track.get("duration_ms", 1)
                device = data.get("device", {})
                context = data.get("context", {})
                
                # Get context name (playlist, album, etc.)
                context_name = None
                context_type = context.get("type") if context else None
                if context and context.get("external_urls", {}).get("spotify"):
                    # We'll fetch the context name separately if needed
                    context_uri = context.get("uri")
                    if context_uri:
                        context_name = context_type  # Will be enhanced by frontend or separate call
                
                return {
                    "authenticated": True,
                    "playing": data.get("is_playing", False),
                    "track": track.get("name", "Unknown"),
                    "artist": ", ".join([artist["name"] for artist in track.get("artists", [])]),
                    "album": track.get("album", {}).get("name", "Unknown"),
                    "album_art": track.get("album", {}).get("images", [{}])[0].get("url"),
                    "progress": int((progress_ms / duration_ms) * 100) if duration_ms > 0 else 0,
                    "duration_ms": duration_ms,
                    "progress_ms": progress_ms,
                    "volume_percent": device.get("volume_percent", 50),
                    "context_type": context_type,
                    "context_uri": context.get("uri") if context else None
                }
            
            return {
                "authenticated": True,
                "playing": False,
                "error": f"Spotify API returned status {response.status_code}"
            }
            
        except Exception as e:
            return {
                "authenticated": True,
                "playing": False,
                "error": str(e)
            }

@router.post("/play")
async def play_music():
    """Resume playback."""
    token = await get_valid_token()
    
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated with Spotify")
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.put(
                "https://api.spotify.com/v1/me/player/play",
                headers={"Authorization": f"Bearer {token}"}
            )
            
            if response.status_code in [204, 202]:
                return {"status": "success", "message": "Playback started"}
            else:
                raise HTTPException(status_code=response.status_code, detail="Failed to start playback")
                
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

@router.post("/pause")
async def pause_music():
    """Pause playback."""
    token = await get_valid_token()
    
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated with Spotify")
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.put(
                "https://api.spotify.com/v1/me/player/pause",
                headers={"Authorization": f"Bearer {token}"}
            )
            
            if response.status_code in [204, 202]:
                return {"status": "success", "message": "Playback paused"}
            else:
                raise HTTPException(status_code=response.status_code, detail="Failed to pause playback")
                
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

@router.post("/next")
async def next_track():
    """Skip to next track."""
    token = await get_valid_token()
    
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated with Spotify")
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                "https://api.spotify.com/v1/me/player/next",
                headers={"Authorization": f"Bearer {token}"}
            )
            
            if response.status_code in [204, 202]:
                return {"status": "success", "message": "Skipped to next track"}
            else:
                raise HTTPException(status_code=response.status_code, detail="Failed to skip track")
                
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

@router.post("/previous")
async def previous_track():
    """Skip to previous track."""
    token = await get_valid_token()
    
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated with Spotify")
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                "https://api.spotify.com/v1/me/player/previous",
                headers={"Authorization": f"Bearer {token}"}
            )
            
            if response.status_code in [204, 202]:
                return {"status": "success", "message": "Skipped to previous track"}
            else:
                raise HTTPException(status_code=response.status_code, detail="Failed to skip track")
                
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

@router.get("/status")
async def get_status():
    """Check authentication status."""
    token = await get_valid_token()
    return {
        "authenticated": token is not None,
        "has_refresh_token": spotify_tokens["refresh_token"] is not None
    }

@router.post("/volume")
async def set_volume(volume_percent: int):
    """Set playback volume (0-100)."""
    token = await get_valid_token()
    
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    if not 0 <= volume_percent <= 100:
        raise HTTPException(status_code=400, detail="Volume must be between 0 and 100")
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.put(
                f"https://api.spotify.com/v1/me/player/volume?volume_percent={volume_percent}",
                headers={"Authorization": f"Bearer {token}"}
            )
            
            if response.status_code in [204, 200]:
                return {"success": True, "volume": volume_percent}
            else:
                raise HTTPException(status_code=response.status_code, detail="Failed to set volume")
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

@router.post("/seek")
async def seek_to_position(position_ms: int):
    """Seek to a specific position in the current track."""
    token = await get_valid_token()
    
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    if position_ms < 0:
        raise HTTPException(status_code=400, detail="Position must be positive")
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.put(
                f"https://api.spotify.com/v1/me/player/seek?position_ms={position_ms}",
                headers={"Authorization": f"Bearer {token}"}
            )
            
            if response.status_code in [204, 200]:
                return {"success": True, "position_ms": position_ms}
            else:
                raise HTTPException(status_code=response.status_code, detail="Failed to seek")
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

@router.get("/queue")
async def get_queue():
    """Get the current playback queue."""
    token = await get_valid_token()
    
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                "https://api.spotify.com/v1/me/player/queue",
                headers={"Authorization": f"Bearer {token}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Format the queue data
                queue_items = []
                for item in data.get("queue", [])[:10]:  # Limit to 10 items
                    album_images = item.get("album", {}).get("images", [])
                    album_art = album_images[0].get("url") if album_images else None
                    
                    queue_items.append({
                        "name": item.get("name"),
                        "artist": ", ".join([artist.get("name", "") for artist in item.get("artists", [])]),
                        "album": item.get("album", {}).get("name"),
                        "album_art": album_art,
                        "duration_ms": item.get("duration_ms"),
                        "uri": item.get("uri")
                    })
                
                return {
                    "currently_playing": {
                        "name": data.get("currently_playing", {}).get("name"),
                        "artist": ", ".join([artist.get("name", "") for artist in data.get("currently_playing", {}).get("artists", [])])
                    } if data.get("currently_playing") else None,
                    "queue": queue_items
                }
            else:
                return {"queue": []}
        except Exception as e:
            print(f"Error fetching queue: {e}")
            return {"queue": []}

@router.get("/context/{context_type}/{context_id}")
async def get_context_info(context_type: str, context_id: str):
    """Get information about the current playback context (playlist, album, etc.)."""
    token = await get_valid_token()
    
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    async with httpx.AsyncClient() as client:
        try:
            # Build the appropriate endpoint based on context type
            endpoint = f"https://api.spotify.com/v1/{context_type}s/{context_id}"
            
            response = await client.get(
                endpoint,
                headers={"Authorization": f"Bearer {token}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                return {
                    "name": data.get("name"),
                    "type": context_type,
                    "owner": data.get("owner", {}).get("display_name") if context_type == "playlist" else None,
                    "total_tracks": data.get("tracks", {}).get("total") if context_type == "playlist" else data.get("total_tracks")
                }
            else:
                # Return None instead of generic response when API call fails
                return None
        except Exception as e:
            print(f"Error fetching context: {e}")
            return None
