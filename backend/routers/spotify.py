from fastapi import APIRouter, HTTPException, Request, Depends, Response
from fastapi.responses import RedirectResponse
import httpx
import os
from dotenv import load_dotenv
import base64
from datetime import datetime, timedelta
from typing import Optional
from sqlmodel import Session, select
from backend.database import get_session
from backend.models import User, UserToken
from backend.auth import get_current_user, require_user

router = APIRouter()

# Load environment variables
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(CURRENT_DIR)
ENV_PATH = os.path.join(BACKEND_DIR, '.env')
load_dotenv(ENV_PATH)

SPOTIFY_CLIENT_ID = os.getenv("SPOTIFY_CLIENT_ID")
SPOTIFY_CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET")
SPOTIFY_REDIRECT_URI = os.getenv("SPOTIFY_REDIRECT_URI", "http://localhost:8080/api/spotify/callback")

async def get_user_spotify_token(user: User, session: Session) -> Optional[UserToken]:
    """Get Spotify token for a specific user from database."""
    statement = select(UserToken).where(
        UserToken.user_id == user.id,
        UserToken.service == "spotify"
    )
    result = await session.execute(statement)
    return result.scalars().first()

def get_auth_header() -> str:
    """Generate Basic Auth header for Spotify API."""
    auth_string = f"{SPOTIFY_CLIENT_ID}:{SPOTIFY_CLIENT_SECRET}"
    auth_bytes = auth_string.encode("utf-8")
    auth_base64 = base64.b64encode(auth_bytes).decode("utf-8")
    return f"Basic {auth_base64}"

async def refresh_spotify_token(user: User, session: Session) -> bool:
    """Refresh the Spotify access token using the refresh token."""
    token = await get_user_spotify_token(user, session)
    if not token or not token.refresh_token:
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
                    "refresh_token": token.refresh_token
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                token.access_token = data["access_token"]
                token.expires_at = datetime.now() + timedelta(seconds=data["expires_in"])
                token.updated_at = datetime.now()
                session.add(token)
                await session.commit()
                return True
        except Exception as e:
            print(f"Error refreshing Spotify token: {e}")
    
    return False

async def get_valid_spotify_token(user: User, session: Session) -> Optional[str]:
    """Get a valid access token, refreshing if necessary."""
    token = await get_user_spotify_token(user, session)
    if not token or not token.access_token:
        return None
    
    # Check if token is expired or about to expire
    if token.expires_at and datetime.now() >= token.expires_at - timedelta(minutes=5):
        if await refresh_spotify_token(user, session):
            token = await get_user_spotify_token(user, session)
            return token.access_token if token else None
        return None
    
    return token.access_token

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
async def spotify_callback(
    code: str,
    user: User = Depends(require_user),
    session: Session = Depends(get_session)
):
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
                
                # Find or create Spotify token for user
                existing_token = await get_user_spotify_token(user, session)
                
                if existing_token:
                    existing_token.access_token = data["access_token"]
                    existing_token.refresh_token = data["refresh_token"]
                    existing_token.expires_at = datetime.now() + timedelta(seconds=data["expires_in"])
                    existing_token.updated_at = datetime.now()
                else:
                    new_token = UserToken(
                        user_id=user.id,
                        service="spotify",
                        access_token=data["access_token"],
                        refresh_token=data["refresh_token"],
                        expires_at=datetime.now() + timedelta(seconds=data["expires_in"])
                    )
                    session.add(new_token)
                
                await session.commit()
                print(f"Spotify tokens saved for user {user.email}")
                
                # Redirect to frontend
                frontend_url = os.getenv('FRONTEND_URL', 'https://life-os-dashboard.com')
                return RedirectResponse(url=f"{frontend_url}?spotify=connected")
            else:
                raise HTTPException(status_code=response.status_code, detail="Failed to get access token")
                
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error during callback: {str(e)}")

@router.get("/token-status")
async def token_status(
    user: User = Depends(require_user),
    session: Session = Depends(get_session)
):
    """Debug endpoint to check token status."""
    token = await get_user_spotify_token(user, session)
    return {
        "has_access_token": bool(token and token.access_token),
        "has_refresh_token": bool(token and token.refresh_token),
        "expires_at": token.expires_at.isoformat() if token and token.expires_at else None,
        "user_email": user.email
    }

@router.get("/current-track")
async def get_current_track(
    user: User = Depends(require_user),
    session: Session = Depends(get_session)
):
    """Get currently playing track."""
    
    token = await get_valid_spotify_token(user, session)
    
    if not token:
        return {
            "authenticated": False,
            "playing": False,
            "message": "Please connect your Spotify account"
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
async def play_music(user: User = Depends(require_user), session: Session = Depends(get_session)):
    """Resume playback."""
    token = await get_valid_spotify_token(user, session)
    
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
async def pause_music(user: User = Depends(require_user), session: Session = Depends(get_session)):
    """Pause playback."""
    token = await get_valid_spotify_token(user, session)
    
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
async def next_track(user: User = Depends(require_user), session: Session = Depends(get_session)):
    """Skip to next track."""
    token = await get_valid_spotify_token(user, session)
    
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
async def previous_track(user: User = Depends(require_user), session: Session = Depends(get_session)):
    """Skip to previous track."""
    token = await get_valid_spotify_token(user, session)
    
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
async def get_status(user: User = Depends(require_user), session: Session = Depends(get_session)):
    """Check authentication status."""
    token_obj = await get_user_spotify_token(user, session)
    return {
        "authenticated": token_obj is not None and token_obj.access_token is not None,
        "has_refresh_token": token_obj is not None and token_obj.refresh_token is not None,
        "user_email": user.email
    }

@router.post("/volume")
async def set_volume(volume_percent: int, user: User = Depends(require_user), session: Session = Depends(get_session)):
    """Set playback volume (0-100)."""
    token = await get_valid_spotify_token(user, session)
    
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
async def seek_to_position(position_ms: int, user: User = Depends(require_user), session: Session = Depends(get_session)):
    """Seek to a specific position in the current track."""
    token = await get_valid_spotify_token(user, session)
    
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
async def get_queue(user: User = Depends(require_user), session: Session = Depends(get_session)):
    """Get the current playback queue."""
    token = await get_valid_spotify_token(user, session)
    
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
    token = await get_valid_spotify_token(user, session)
    
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
