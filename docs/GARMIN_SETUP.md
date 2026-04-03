# Garmin Connect Setup Guide

## Problem
Garmin Connect uses strict authentication that often requires:
- Manual login through browser
- MFA (Multi-Factor Authentication)
- CAPTCHA challenges
- Session tokens that expire

## Solution Options

### Option 1: Manual Browser Authentication (Recommended)
1. Log into https://connect.garmin.com in your browser
2. Complete any MFA/CAPTCHA challenges
3. Keep the browser session active
4. The API should use the same session

### Option 2: Use Garth OAuth Flow
Run the authentication script:
```powershell
cd backend
python authenticate_garmin.py
```

If MFA is required, you'll be prompted to enter the code.

### Option 3: Disable MFA Temporarily
1. Go to Garmin Account Settings
2. Disable Two-Factor Authentication
3. Run authentication script
4. Re-enable MFA

### Option 4: Use Garmin Developer API
For production use, consider:
1. Register for Garmin Developer API access
2. Create an OAuth application
3. Use official OAuth2 flow instead of credentials

## Current Status
The Garmin widget will show an error if authentication fails. To fix:
```powershell
cd backend
python authenticate_garmin.py
```

## Troubleshooting

### "401 Unauthorized" Error
- Session tokens have expired
- Run authentication script again
- May need to log in via browser first

### "Unexpected title: GARMIN Authentication Application"
- Garmin is showing an authentication page
- Usually means MFA or CAPTCHA is required
- Try logging in via browser first

### "Rate Limited"
- Too many authentication attempts
- Wait 10-15 minutes before trying again

## Files
- `backend/.garmin_tokens/` - Stored session tokens
- `backend/authenticate_garmin.py` - Authentication script
- `backend/routers/garmin.py` - API endpoints

## API Endpoints
- `GET /api/garmin/stats` - Today's activity stats
- `GET /api/garmin/sleep?days=7` - Recent sleep data
- `GET /api/garmin/activities?limit=5` - Recent activities
- `GET /api/garmin/status` - Authentication status
