# LifeOS - Personal Dashboard

A personal dashboard that integrates with various services including Spotify, Garmin Connect, Google Calendar, Home Assistant, and more.


![alt text](/docs/Screenshot%202025-11-11%20182735.png?raw=true)

## Features

- 🚌 **Bus Tracking** - Real-time bus arrivals with map visualization
- 🎵 **Spotify Integration** - Currently playing track with playback controls
- 🏃 **Garmin Connect** - Activity stats, sleep tracking, and workout history
- 🏠 **Smart Home** - Control lights and check temperature via Home Assistant
- 📅 **7-Day Calendar** - Week view with office day indicators
- 💰 **Finance** - Monzo account balance and spending insights
- 🌱 **Plant Care** - Track plant watering schedules with images
- 📧 **Email** - Gmail inbox preview
- 🌤️ **Weather** - Multi-city weather display
- 🚗 **Car Management** - MOT, tax, and mileage tracking

> **📋 [View the Development Roadmap](./ROADMAP.md)** - See what's planned and contribute ideas!

## Prerequisites

- Python 3.9+ (tested using version 3.13)
- Node.js 16+
### Optional Accounts
- A Garmin Connect account
- Spotify account
- Google account
- Home Assistant instance

## Quick Setup

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/life-os.git
cd life-os
```

### 2. Backend Setup

```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp backend/.env.example backend/.env
```

Edit `backend/.env` with your credentials:

```env
# --- TRANSPORT API ---
TRANSPORT_APP_ID=your_transport_api_id
TRANSPORT_APP_KEY=your_transport_api_key

# --- BUS STOPS ---
MORNING_STOPS=43000053101,4200F036600
EVENING_STOPS=43000053002

# --- HOME ASSISTANT ---
HA_BASE_URL=http://localhost:8123
HA_TOKEN=your_home_assistant_token

# --- SPOTIFY ---
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
SPOTIFY_REDIRECT_URI=http://127.0.0.1:8000/api/spotify/callback

# --- GARMIN CONNECT ---
GARMIN_EMAIL=your_email@example.com
GARMIN_PASSWORD=your_password

# --- DATABASE ---
DATABASE_URL=sqlite+aiosqlite:///./lifeos_data.db
```

### 3. Frontend Setup

```bash
cd frontend
npm install
```

Update `frontend/lib/config.ts` with your backend URL if different from default:

```typescript
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
```

### 4. Run the Application

**Terminal 1 - Backend:**
```bash
# From project root
venv\Scripts\activate  # Windows
source venv/bin/activate  # macOS/Linux

uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

Visit `http://localhost:3000` to see your dashboard!

## Remote Access Setup

Want to access your dashboard from anywhere (work, mobile, etc.)? See the **[Cloudflare Tunnel Setup Guide](CLOUDFLARE_SETUP.md)** for instructions on setting up secure remote access.

**Quick Start:**
```powershell
# Run the automated setup script
.\setup-cloudflare.ps1
```

This enables:
- 🏠 **Fast local access** - Auto-detects when you're home
- 🌐 **Remote access** - Access from work browser, no app installation needed
- 🔒 **Secure** - HTTPS encrypted through Cloudflare
- 🆓 **Free** - No cost for personal use

## API Credentials Setup

### Spotify

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new app
3. Add redirect URI: `http://127.0.0.1:8000/api/spotify/callback`
4. Copy Client ID and Client Secret to `.env`
5. Click "Connect Spotify" in the widget to authenticate

### Garmin Connect

Simply add your Garmin Connect email and password to `.env`. No API keys needed!

### Transport API (UK Only)

1. Register at [TransportAPI](https://www.transportapi.com/)
2. Get your App ID and App Key
3. Find your bus stop IDs from the TransportAPI website
4. Add to `.env`

### Google Calendar

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable Google Calendar API
4. Create OAuth 2.0 credentials
5. Download `credentials.json` and place in `backend/`

### Home Assistant

1. Open your Home Assistant instance
2. Go to Profile → Long-Lived Access Tokens
3. Create a token and add to `.env`

## Database

The app uses SQLite by default. To initialize the database:

1. Visit `http://localhost:8000/api/init-db`
2. This creates all necessary tables

## Project Structure

```
life-os/
├── backend/
│   ├── routers/           # API endpoints
│   │   ├── spotify.py
│   │   ├── garmin.py
│   │   ├── google.py
│   │   ├── plants.py
│   │   └── smarthome.py
│   ├── models.py          # Database models
│   ├── database.py        # Database connection
│   └── main.py            # FastAPI app
├── frontend/
│   ├── app/
│   │   └── page.tsx       # Main dashboard
│   ├── components/
│   │   └── widgets/       # Dashboard widgets
│   └── lib/               # Utilities and types
└── requirements.txt
```

## Features in Detail

### Garmin Widget
- Daily stats (steps, calories, distance, active minutes)
- Sleep tracking with 7-day history graph
- Recent workout history
- Heart rate monitoring
- Body metrics (weight, stress)

Data refreshes on page load, cached for 5 minutes.

### Spotify Widget
- Currently playing track with album art
- Playback controls (play/pause/next/previous)
- Works with music and podcasts
- Auto-refreshes every 5 seconds

### Plant Widget
- Track multiple plants
- Watering schedules
- Visual indicators for plants needing water
- Add plants with custom images

## Troubleshooting

### Backend won't start
- Make sure virtual environment is activated
- Check all environment variables are set in `.env`
- Verify port 8000 is not in use

### Spotify shows "Invalid redirect URI"
- Ensure redirect URI in Spotify Dashboard matches exactly: `http://127.0.0.1:8000/api/spotify/callback`
- Use `127.0.0.1` not `localhost`

### Garmin data shows zeros
- Make sure you've synced your Garmin device today
- Verify email/password in `.env` are correct
- Check Garmin Connect account is accessible

### Frontend can't connect to backend
- Check backend is running on port 8000
- Update `API_BASE_URL` in frontend if needed
- Check CORS settings in `backend/main.py`

## Development

### Adding a New Widget

1. Create widget component in `frontend/components/widgets/YourWidget.tsx`
2. Import and add to `frontend/app/page.tsx`
3. Create backend router in `backend/routers/your_feature.py`
4. Register router in `backend/main.py`

### Database Migrations

For schema changes, create migration scripts in `backend/` (see `migrate_add_image_url.py` as example).

## Contributing

Contributions welcome! Please feel free to submit a Pull Request.

## License

MIT License - feel free to use this for your own personal dashboard!

## Acknowledgments

- Built with FastAPI and Next.js
- Uses unofficial Garmin Connect API via [garminconnect](https://github.com/cyberjunky/python-garminconnect)
- Spotify Web API
- TransportAPI for UK bus data
