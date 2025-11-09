# Cloudflare Tunnel Setup Guide

This guide will help you set up Cloudflare Tunnel to access your Life OS dashboard remotely while maintaining fast local access.

## Overview

With this setup:
- **At home**: App automatically uses your local IP (192.168.4.28:8000) - FAST ⚡
- **Remote (work, etc.)**: App uses Cloudflare Tunnel URL - works anywhere 🌐
- **No installation needed**: Just open a browser

## Prerequisites

- Cloudflare account (free): https://dash.cloudflare.com/sign-up
- Your PC must be running when you want remote access
- Windows PowerShell with admin privileges

## Step 1: Install Cloudflared

### Option A: Using Winget (Recommended)
```powershell
winget install --id Cloudflare.cloudflared
```

### Option B: Manual Download
1. Download from: https://github.com/cloudflare/cloudflared/releases/latest
2. Look for `cloudflared-windows-amd64.exe`
3. Rename to `cloudflared.exe` and move to `C:\Windows\System32\`

### Verify Installation
```powershell
cloudflared --version
```

## Step 2: Authenticate with Cloudflare

```powershell
cloudflared tunnel login
```

This opens a browser window. Log in and authorize cloudflared.

## Step 3: Create a Tunnel

```powershell
# Create a tunnel named "lifeos"
cloudflared tunnel create lifeos

# Note the Tunnel ID that's displayed (looks like: 12345678-1234-1234-1234-123456789abc)
```

## Step 4: Create Tunnel Configuration

Create a file at `C:\Users\YOUR_USERNAME\.cloudflared\config.yml`:

```yaml
tunnel: lifeos
credentials-file: C:\Users\YOUR_USERNAME\.cloudflared\TUNNEL_ID.json

ingress:
  # Frontend (Next.js)
  - hostname: lifeos-app.trycloudflare.com
    service: http://localhost:3000
  
  # Backend (FastAPI)  
  - hostname: lifeos-api.trycloudflare.com
    service: http://localhost:8000
  
  # Catch-all rule (required)
  - service: http_status:404
```

**Important**: Replace `YOUR_USERNAME` and `TUNNEL_ID` with your actual values.

## Step 5: Route Your Tunnel

### Option A: Quick Start (Random URL - Free)
```powershell
cloudflared tunnel run lifeos
```

This gives you a random URL like `https://random-name.trycloudflare.com`

### Option B: Custom Domain (Requires Domain)
If you have a domain on Cloudflare:

```powershell
# Add DNS records
cloudflared tunnel route dns lifeos lifeos-app.yourdomain.com
cloudflared tunnel route dns lifeos lifeos-api.yourdomain.com

# Run the tunnel
cloudflared tunnel run lifeos
```

## Step 6: Run as a Windows Service (Auto-start)

To make the tunnel start automatically on boot:

```powershell
# Install as service
cloudflared service install

# Start the service
cloudflared service start
```

To stop/uninstall:
```powershell
cloudflared service stop
cloudflared service uninstall
```

## Step 7: Update Your App Configuration

### Frontend Environment Variables

Create/update `frontend/.env.local`:

```env
# Your Cloudflare Tunnel URL for the backend API
NEXT_PUBLIC_CLOUDFLARE_URL=https://lifeos-api.trycloudflare.com
```

### OAuth Redirect URIs

You need to add your Cloudflare URLs to your OAuth apps:

#### Spotify Developer Dashboard
1. Go to: https://developer.spotify.com/dashboard
2. Select your app
3. Click "Edit Settings"
4. Add to Redirect URIs:
   ```
   https://lifeos-api.trycloudflare.com/api/spotify/callback
   ```
5. Save

#### Google Cloud Console
1. Go to: https://console.cloud.google.com/apis/credentials
2. Select your OAuth 2.0 Client ID
3. Add to "Authorized redirect URIs":
   ```
   https://lifeos-api.trycloudflare.com/api/google/callback
   ```
4. Save

### Backend Environment Variables

Update `backend/.env`:

```env
# Update these with your Cloudflare URLs
SPOTIFY_REDIRECT_URI=https://lifeos-api.trycloudflare.com/api/spotify/callback
# Add Google redirect if needed
```

## Step 8: Test Your Setup

1. **Start your backend**:
   ```powershell
   cd d:\Personal\Coding\life-os
   .\venv\Scripts\activate
   uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
   ```

2. **Start your frontend**:
   ```powershell
   cd d:\Personal\Coding\life-os\frontend
   npm run dev -- -H 0.0.0.0
   ```

3. **Start your tunnel**:
   ```powershell
   cloudflared tunnel run lifeos
   ```

4. **Test local access** (at home):
   - Open: `http://192.168.4.28:3000`
   - Check browser console - should see: "✅ Local API detected"

5. **Test remote access**:
   - Open: `https://lifeos-app.trycloudflare.com` (or your URL)
   - Check browser console - should see: "🌐 Local API not reachable - using remote connection"

## Troubleshooting

### "Connection refused" error
- Make sure backend is running on port 8000
- Check Windows Firewall isn't blocking the ports
- Verify `--host 0.0.0.0` is used when starting uvicorn

### OAuth redirect errors
- Double-check you added the Cloudflare URLs to Spotify/Google dashboards
- Make sure URLs match exactly (https, no trailing slash)
- Wait a few minutes after updating OAuth settings

### Tunnel not starting
```powershell
# Check tunnel status
cloudflared tunnel list

# Check service status
cloudflared service status

# View logs
cloudflared tunnel run lifeos --loglevel debug
```

### App always uses remote URL at home
- Check that `192.168.4.28:8000` is accessible in your browser
- Open browser dev tools and check console for detection messages
- Try resetting detection by refreshing the page

### Slow when at home
- Verify you see "✅ Local API detected" in browser console
- If not, your local IP might have changed - update `frontend/lib/config.ts`
- Check your router hasn't changed your PC's IP address

## Security Best Practices

1. **Enable Cloudflare Access** (Optional - adds login):
   ```powershell
   cloudflared tunnel route dns lifeos --cloudflare-access
   ```

2. **Keep credentials secure**:
   - Never commit `.cloudflared/` directory to git
   - Keep your tunnel credentials file private

3. **Monitor access**:
   - Check Cloudflare dashboard for traffic analytics
   - Review connection logs in Cloudflare

## Maintenance

### Update cloudflared
```powershell
winget upgrade Cloudflare.cloudflared
# or download latest from GitHub
```

### Change tunnel URLs
1. Update `config.yml` with new hostnames
2. Restart tunnel: `cloudflared service restart`

### Stop remote access temporarily
```powershell
cloudflared service stop
```

## Cost

- **Cloudflare Tunnel**: FREE forever ✅
- **Custom domain**: Optional ($10-15/year for domain)
- **Cloudflare Access**: Free for up to 50 users

## Alternative: Quick Temporary Tunnel

For quick testing without full setup:

```powershell
# Backend tunnel (temporary URL)
cloudflared tunnel --url http://localhost:8000

# Frontend tunnel (temporary URL)  
cloudflared tunnel --url http://localhost:3000
```

This gives you instant URLs but they change every time you restart.

---

**Need Help?**
- Cloudflare Docs: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/
- Report issues: https://github.com/cloudflare/cloudflared/issues
