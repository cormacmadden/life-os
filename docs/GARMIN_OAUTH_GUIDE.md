# Garmin OAuth2 Implementation Guide

## Why OAuth2?

The current password-based authentication triggers Garmin's security measures, causing:
- Automatic password resets
- Account rate limiting
- Potential account lockouts

OAuth2 is the official, secure way to access Garmin Connect data.

## Steps to Implement

### 1. Register as Garmin Developer

1. Go to https://developer.garmin.com/
2. Create a Garmin Developer account
3. Navigate to "Applications" → "Create Application"
4. Fill out the application details:
   - **Application Name**: Life OS Dashboard
   - **Description**: Personal dashboard for tracking fitness data
   - **Application Type**: Web Application
   - **Redirect URL**: `http://localhost:8000/api/garmin/callback` (for local testing)
   - **Redirect URL**: `https://api.life-os-dashboard.com/api/garmin/callback` (for production)

5. Note your credentials:
   - Consumer Key (Client ID)
   - Consumer Secret (Client Secret)

### 2. Add OAuth2 Dependencies

```powershell
cd backend
pip install authlib requests-oauthlib
```

Update `requirements.txt`:
```
authlib>=1.2.0
requests-oauthlib>=1.3.1
```

### 3. Update Environment Variables

Add to `backend/.env`:
```
# Garmin OAuth2
GARMIN_CLIENT_ID=your_consumer_key_here
GARMIN_CLIENT_SECRET=your_consumer_secret_here
GARMIN_REDIRECT_URI=http://localhost:8000/api/garmin/callback
```

### 4. Implement OAuth2 Flow

Create `backend/routers/garmin_oauth.py`:

```python
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import RedirectResponse
from authlib.integrations.requests_client import OAuth2Session
import os
from dotenv import load_dotenv

load_dotenv()

router = APIRouter()

GARMIN_CLIENT_ID = os.getenv("GARMIN_CLIENT_ID")
GARMIN_CLIENT_SECRET = os.getenv("GARMIN_CLIENT_SECRET")
GARMIN_REDIRECT_URI = os.getenv("GARMIN_REDIRECT_URI")

GARMIN_AUTH_URL = "https://connect.garmin.com/oauthConfirm"
GARMIN_TOKEN_URL = "https://connectapi.garmin.com/oauth-service/oauth/access_token"

# Store tokens (use proper database in production)
_tokens = {}

@router.get("/auth")
async def garmin_auth():
    """Initiate OAuth2 flow."""
    session = OAuth2Session(
        GARMIN_CLIENT_ID,
        GARMIN_CLIENT_SECRET,
        redirect_uri=GARMIN_REDIRECT_URI
    )
    
    authorization_url, state = session.create_authorization_url(GARMIN_AUTH_URL)
    
    # Store state for verification
    _tokens['state'] = state
    
    return RedirectResponse(authorization_url)

@router.get("/callback")
async def garmin_callback(request: Request):
    """Handle OAuth2 callback."""
    code = request.query_params.get('code')
    state = request.query_params.get('state')
    
    # Verify state
    if state != _tokens.get('state'):
        raise HTTPException(status_code=400, detail="Invalid state")
    
    session = OAuth2Session(
        GARMIN_CLIENT_ID,
        GARMIN_CLIENT_SECRET,
        redirect_uri=GARMIN_REDIRECT_URI
    )
    
    # Exchange code for token
    token = session.fetch_token(
        GARMIN_TOKEN_URL,
        authorization_response=str(request.url)
    )
    
    # Store token (use database in production)
    _tokens['access_token'] = token
    
    return {"message": "Successfully authenticated with Garmin!"}

@router.get("/revoke")
async def revoke_token():
    """Revoke OAuth token."""
    _tokens.clear()
    return {"message": "Token revoked"}
```

### 5. Update Main Router

In `backend/routers/garmin.py`, add OAuth2 support:

```python
def get_garmin_client_oauth():
    """Get authenticated Garmin client using OAuth2."""
    from .garmin_oauth import _tokens
    
    if 'access_token' not in _tokens:
        raise HTTPException(
            status_code=401, 
            detail="Not authenticated. Visit /api/garmin/auth to authenticate"
        )
    
    # Use OAuth token to make API requests
    access_token = _tokens['access_token']
    
    # Initialize Garmin client with OAuth token
    # (requires garminconnect library update to support OAuth)
    ...
```

### 6. Register OAuth Router

In `backend/main.py`:

```python
from routers import garmin_oauth

app.include_router(garmin_oauth.router, prefix="/api/garmin", tags=["garmin"])
```

### 7. Authentication Flow for Users

1. User visits: `http://localhost:8000/api/garmin/auth`
2. Redirected to Garmin login page
3. User logs in and grants permissions
4. Redirected back to `/api/garmin/callback`
5. Token is stored and used for API requests

## Alternative: Use Garmin Health API

Garmin also offers the **Garmin Health API** for developers:
- https://developer.garmin.com/gc-developer-program/health-api/
- More reliable for automated access
- Requires application approval
- Supports webhooks for real-time data

## Benefits of OAuth2

✅ No password storage
✅ No automatic password resets
✅ Tokens can be refreshed automatically
✅ Official, supported authentication method
✅ Better security
✅ Fewer rate limits

## Limitations

⚠️ Requires initial manual authentication
⚠️ Tokens expire (but can be refreshed)
⚠️ More complex setup
⚠️ May require application approval

## Current Status

The current implementation uses password authentication which is:
- ❌ Triggering security measures
- ❌ Causing password resets
- ❌ Not recommended by Garmin

**Recommendation**: Implement OAuth2 for production use or disable Garmin integration until OAuth2 is implemented.
