from fastapi import APIRouter
from fastapi.responses import RedirectResponse
import os
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
import datetime

router = APIRouter()

# --- CONFIGURATION ---
# Get the directory that THIS file (google.py) is in
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
# Go up one level to find the 'backend' parent directory
BACKEND_DIR = os.path.dirname(CURRENT_DIR)

# Now construct absolute paths to your sensitive files
CREDENTIALS_FILE = os.path.join(BACKEND_DIR, 'credentials.json')
TOKEN_FILE = os.path.join(BACKEND_DIR, 'token.json')

SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/calendar.events.readonly'
]
# ---------------------
@router.get("/login")
async def google_login():
    flow = InstalledAppFlow.from_client_secrets_file(
        CREDENTIALS_FILE, SCOPES,
        redirect_uri='http://127.0.0.1:8000/api/google/callback'
    )
    auth_url, _ = flow.authorization_url(prompt='consent')
    return {"auth_url": auth_url}

@router.get("/callback")
async def google_callback(code: str):
    flow = InstalledAppFlow.from_client_secrets_file(
        CREDENTIALS_FILE, SCOPES,
        redirect_uri='http://127.0.0.1:8000/api/google/callback'
    )
    flow.fetch_token(code=code)
    with open(TOKEN_FILE, 'w') as token:
        token.write(flow.credentials.to_json())
    return RedirectResponse("http://localhost:3000")

async def get_creds():
    creds = None
    if os.path.exists(TOKEN_FILE):
        creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            return None
    return creds

@router.get("/data")
async def get_google_data():
    creds = await get_creds()
    if not creds:
        return {"authenticated": False}

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