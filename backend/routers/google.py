from fastapi import APIRouter, Depends, Response
from fastapi.responses import RedirectResponse
import os
from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
import datetime
from sqlmodel import Session, select
from backend.database import get_session, get_sync_session
from backend.models import User, UserToken
from backend.auth import get_current_user, require_user, create_access_token, set_auth_cookie

router = APIRouter()

# --- CONFIGURATION ---
# Get the directory that THIS file (google.py) is in
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
# Go up one level to find the 'backend' parent directory
BACKEND_DIR = os.path.dirname(CURRENT_DIR)

# Now construct absolute paths to your sensitive files
import dotenv
# Load .env but don't override existing environment variables (from Cloud Run)
dotenv.load_dotenv(os.path.join(BACKEND_DIR, '.env'), override=False)
CREDENTIALS_FILE = os.getenv('GOOGLE_CREDENTIALS_FILE', os.path.join(BACKEND_DIR, 'credentials.json'))
TOKEN_FILE = os.getenv('GOOGLE_TOKEN_FILE', os.path.join(BACKEND_DIR, 'token.json'))

def get_redirect_uri() -> str:
    """Get redirect URI from environment, prioritizing Cloud Run env vars over .env file"""
    return os.getenv('GOOGLE_REDIRECT_URI', 'https://life-os-dashboard.com/api/google/callback')

def get_post_login_redirect() -> str:
    """Get post-login redirect URL from environment"""
    return os.getenv('GOOGLE_POST_LOGIN_REDIRECT', 'https://life-os-dashboard.com')

SCOPES = [
    'openid',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/calendar.events.readonly'
]
# ---------------------
@router.get("/login")
async def google_login():
    """Initiate Google OAuth flow"""
    redirect_uri = get_redirect_uri()

    if not os.path.exists(CREDENTIALS_FILE):
        return {
            "error": "Google OAuth not configured",
            "message": f"credentials.json not found at {CREDENTIALS_FILE}. Please configure Google OAuth credentials."
        }
    
    flow = Flow.from_client_secrets_file(
        CREDENTIALS_FILE, 
        scopes=SCOPES,
        redirect_uri=redirect_uri
    )
    auth_url, state = flow.authorization_url(
        prompt='consent',
        access_type='offline',
        include_granted_scopes='true'
    )
    return {"auth_url": auth_url}

@router.get("/callback")
async def google_callback(
    code: str,
    response: Response,
    state: str = None,
    session: Session = Depends(get_sync_session)
):
    """Handle Google OAuth callback and create/login user"""
    try:
        print(f"🔵 Callback received with code: {code[:20]}...")
        redirect_uri = get_redirect_uri()
        flow = Flow.from_client_secrets_file(
            CREDENTIALS_FILE,
            scopes=SCOPES,
            redirect_uri=redirect_uri,
            state=state,
        )
        # Suppress scope mismatch warnings
        import warnings
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            flow.fetch_token(code=code)
        creds = flow.credentials
        print(f"🔵 Token fetched successfully")
        print(f"🔵 Token: {creds.token[:20]}...")
        
        # Get user info from Google using the credentials
        user_info_service = build('oauth2', 'v2', credentials=creds, static_discovery=False)
        user_info = user_info_service.userinfo().get().execute()
        print(f"🔵 User info: {user_info.get('email')}")
    except Exception as e:
        print(f"❌ ERROR in callback: {e}")
        import traceback
        traceback.print_exc()
        raise
    
    google_id = user_info['id']
    email = user_info['email']
    name = user_info.get('name')
    picture = user_info.get('picture')
    
    # 1. Try to find user by google_id (returning user)
    user = session.exec(select(User).where(User.google_id == google_id)).first()

    if user:
        print(f"🔵 Found existing user by google_id: {user.email}")
        user.email = email
        user.name = name
        user.picture = picture
        user.last_login = datetime.datetime.utcnow()
    else:
        # 2. Try to find by email (account exists but never logged in with Google)
        user = session.exec(select(User).where(User.email == email)).first()
        if user:
            print(f"🔵 Linking Google account to existing user: {user.email}")
            user.google_id = google_id
            user.name = name or user.name
            user.picture = picture or user.picture
            user.last_login = datetime.datetime.utcnow()
        else:
            # 3. Brand new user
            print(f"🔵 Creating new user: {email}")
            user = User(
                email=email,
                google_id=google_id,
                name=name,
                picture=picture,
                last_login=datetime.datetime.utcnow()
            )
            session.add(user)

    session.commit()
    session.refresh(user)
    print(f"🔵 User ID: {user.id}")
    
    # Store Google tokens
    token_statement = select(UserToken).where(
        UserToken.user_id == user.id,
        UserToken.service == "google"
    )
    existing_token = session.exec(token_statement).first()
    
    expires_at = None
    if creds.expiry:
        expires_at = creds.expiry
    
    if existing_token:
        existing_token.access_token = creds.token
        existing_token.refresh_token = creds.refresh_token
        existing_token.expires_at = expires_at
        existing_token.updated_at = datetime.datetime.utcnow()
    else:
        user_token = UserToken(
            user_id=user.id,
            service="google",
            access_token=creds.token,
            refresh_token=creds.refresh_token,
            token_type=creds.token_uri,
            expires_at=expires_at,
            scope=" ".join(SCOPES)
        )
        session.add(user_token)
    
    session.commit()
    
    # Create JWT token for our app
    access_token = create_access_token(user.id, user.email)
    
    # Set cookie and redirect
    redirect_response = RedirectResponse(
        os.getenv('GOOGLE_POST_LOGIN_REDIRECT', 'https://life-os-dashboard.com')
    )
    set_auth_cookie(redirect_response, access_token)
    
    return redirect_response

async def get_user_google_creds(user: User, session: Session):
    """Get Google credentials for a specific user"""
    statement = select(UserToken).where(
        UserToken.user_id == user.id,
        UserToken.service == "google"
    )
    token = (await session.exec(statement)).first()
    
    if not token:
        return None
    
    creds = Credentials(
        token=token.access_token,
        refresh_token=token.refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=None,  # Not needed for API calls
        client_secret=None,  # Not needed for API calls
        scopes=token.scope.split(" ") if token.scope else SCOPES
    )
    
    # Refresh if expired
    if creds.expired and creds.refresh_token:
        creds.refresh(GoogleRequest())
        # Update stored token
        token.access_token = creds.token
        if creds.expiry:
            token.expires_at = creds.expiry
        token.updated_at = datetime.datetime.utcnow()
        session.add(token)
        session.commit()
    
    return creds

@router.get("/data")
async def get_google_data(
    user: User = Depends(require_user),
    session: Session = Depends(get_session)
):
    """Get user's Gmail and Calendar data"""
    creds = await get_user_google_creds(user, session)
    if not creds:
        return {"authenticated": False, "error": "Google account not connected"}

    # 1. GMAIL
    gmail = build('gmail', 'v1', credentials=creds)
    results = gmail.users().messages().list(userId='me', labelIds=['INBOX'], maxResults=3).execute()
    email_data = []
    for msg in results.get('messages', []):
        txt = gmail.users().messages().get(userId='me', id=msg['id']).execute()
        headers = txt['payload']['headers']
        subject = next((h['value'] for h in headers if h['name'] == 'Subject'), "No Subject")
        sender = next((h['value'] for h in headers if h['name'] == 'From'), "Unknown")
        # Simplified sender name (e.g., "Amazon <noreply@amazon.com>" -> "Amazon")
        if "<" in sender: sender = sender.split("<")[0].strip().replace('"', '')
        email_data.append({"from": sender, "subject": subject, "time": "recent", "important": False, "id": msg['id']})

    # 2. CALENDAR - Get next 7 days of events
    calendar = build('calendar', 'v3', credentials=creds)
    now = datetime.datetime.utcnow()
    time_min = now.isoformat() + 'Z'
    time_max = (now + datetime.timedelta(days=7)).isoformat() + 'Z'
    
    events = calendar.events().list(
        calendarId='primary', 
        timeMin=time_min,
        timeMax=time_max,
        singleEvents=True, 
        orderBy='startTime'
    ).execute()
    
    calendar_data = []
    for event in events.get('items', []):
        start = event['start'].get('dateTime', event['start'].get('date'))
        
        # Parse the date/datetime
        if 'T' in start:
            # Has time component
            event_dt = datetime.datetime.fromisoformat(start.replace('Z', '+00:00'))
            time_str = event_dt.strftime('%H:%M')
            date_str = event_dt.strftime('%Y-%m-%d')
            day_name = event_dt.strftime('%A')
        else:
            # All-day event
            event_dt = datetime.datetime.fromisoformat(start)
            time_str = 'All day'
            date_str = start
            day_name = event_dt.strftime('%A')
        
        calendar_data.append({
            "id": event['id'], 
            "title": event['summary'], 
            "time": time_str,
            "date": date_str,
            "day": day_name,
            "type": "personal"
        })

    return {"authenticated": True, "emails": email_data, "calendar": calendar_data}