# Spotify Integration Setup

## Steps to Get Spotify Working

### 1. Create a Spotify App
1. Go to https://developer.spotify.com/dashboard
2. Log in with your Spotify account
3. Click "Create app"
4. Fill in the details:
   - **App name**: LifeOS
   - **App description**: Personal dashboard integration
   - **Redirect URI**: `http://localhost:8000/api/spotify/callback`
   - **API**: Select "Web API"
5. Accept the terms and click "Save"

### 2. Get Your Credentials
1. In your new app's dashboard, click "Settings"
2. Copy your **Client ID**
3. Click "View client secret" and copy your **Client Secret**

### 3. Update Your `.env` File
Edit `backend/.env` and replace these values:

```env
SPOTIFY_CLIENT_ID=your_actual_client_id_here
SPOTIFY_CLIENT_SECRET=your_actual_client_secret_here
SPOTIFY_REDIRECT_URI=http://localhost:8000/api/spotify/callback
```

### 4. Restart Your Backend
The uvicorn server should auto-reload, but if needed:
```powershell
# Stop and restart in the uvicorn terminal
# Ctrl+C then run again:
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

### 5. Connect Spotify
1. Open your frontend at http://localhost:3000
2. Click the "connect spotify" button in the Spotify widget
3. Authorize the app in the Spotify login page
4. You'll be redirected back and the widget will start showing your current track!

## Features
- ✅ Real-time currently playing track
- ✅ Album artwork display
- ✅ Play/Pause control
- ✅ Skip forward/backward
- ✅ Progress bar
- ✅ Auto-refreshes every 5 seconds

## Troubleshooting

**"Not authenticated" error:**
- Make sure you've set up your Spotify app credentials correctly
- Check that the redirect URI in your Spotify app matches exactly: `http://localhost:8000/api/spotify/callback`

**"No track currently playing":**
- Open Spotify on any device and start playing a song
- Make sure your Spotify account is not in private session mode

**Token expired:**
- The backend automatically refreshes tokens, but if you see issues, just click "connect spotify" again
