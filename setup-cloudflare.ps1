# Quick Start: Cloudflare Tunnel Setup
# Run this script after installing cloudflared

Write-Host "🚀 Life OS - Cloudflare Tunnel Quick Setup" -ForegroundColor Cyan
Write-Host ""

# Check if cloudflared is installed
if (!(Get-Command cloudflared -ErrorAction SilentlyContinue)) {
    Write-Host "❌ cloudflared not found. Installing..." -ForegroundColor Red
    Write-Host ""
    Write-Host "Installing via winget..." -ForegroundColor Yellow
    winget install --id Cloudflare.cloudflared
    Write-Host ""
    Write-Host "✅ Installation complete. Please restart PowerShell and run this script again." -ForegroundColor Green
    exit
}

Write-Host "✅ cloudflared is installed" -ForegroundColor Green
Write-Host ""

# Step 1: Login
Write-Host "📝 Step 1: Authenticating with Cloudflare..." -ForegroundColor Cyan
Write-Host "This will open a browser window. Please log in and authorize." -ForegroundColor Yellow
Write-Host ""
cloudflared tunnel login

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Authentication failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ Authentication successful!" -ForegroundColor Green
Write-Host ""

# Step 2: Create tunnel
Write-Host "📝 Step 2: Creating tunnel 'lifeos'..." -ForegroundColor Cyan
$tunnelOutput = cloudflared tunnel create lifeos 2>&1
$tunnelId = ($tunnelOutput | Select-String -Pattern "([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})").Matches.Value

if ($tunnelId) {
    Write-Host "✅ Tunnel created! ID: $tunnelId" -ForegroundColor Green
} else {
    Write-Host "⚠️  Tunnel might already exist. Checking..." -ForegroundColor Yellow
    $tunnelList = cloudflared tunnel list
    if ($tunnelList -match "lifeos") {
        Write-Host "✅ Tunnel 'lifeos' already exists" -ForegroundColor Green
        $tunnelId = ($tunnelList | Select-String -Pattern "([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})").Matches.Value
    } else {
        Write-Host "❌ Failed to create tunnel" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""

# Step 3: Create config file
$cloudflaredPath = "$env:USERPROFILE\.cloudflared"
$configPath = "$cloudflaredPath\config.yml"

Write-Host "📝 Step 3: Creating config file..." -ForegroundColor Cyan

$configContent = @"
tunnel: lifeos
credentials-file: $cloudflaredPath\$tunnelId.json

ingress:
  # Backend API
  - hostname: lifeos-api.trycloudflare.com
    service: http://localhost:8000
  
  # Frontend App
  - hostname: lifeos-app.trycloudflare.com
    service: http://localhost:3000
  
  # Catch-all
  - service: http_status:404
"@

$configContent | Out-File -FilePath $configPath -Encoding UTF8

Write-Host "✅ Config file created at: $configPath" -ForegroundColor Green
Write-Host ""

# Step 4: Update environment file
Write-Host "📝 Step 4: Updating frontend environment..." -ForegroundColor Cyan

$frontendEnvPath = "frontend\.env.local"
if (Test-Path $frontendEnvPath) {
    $envContent = Get-Content $frontendEnvPath
    if ($envContent -match "NEXT_PUBLIC_CLOUDFLARE_URL") {
        Write-Host "⚠️  NEXT_PUBLIC_CLOUDFLARE_URL already exists in .env.local" -ForegroundColor Yellow
    } else {
        Add-Content -Path $frontendEnvPath -Value "`nNEXT_PUBLIC_CLOUDFLARE_URL=https://lifeos-api.trycloudflare.com"
        Write-Host "✅ Added CLOUDFLARE_URL to .env.local" -ForegroundColor Green
    }
} else {
    "NEXT_PUBLIC_CLOUDFLARE_URL=https://lifeos-api.trycloudflare.com" | Out-File -FilePath $frontendEnvPath -Encoding UTF8
    Write-Host "✅ Created .env.local with CLOUDFLARE_URL" -ForegroundColor Green
}

Write-Host ""

# Summary
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "🎉 Setup Complete!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Start your backend:" -ForegroundColor White
Write-Host "   .\venv\Scripts\activate" -ForegroundColor Gray
Write-Host "   uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Start your frontend:" -ForegroundColor White
Write-Host "   cd frontend" -ForegroundColor Gray
Write-Host "   npm run dev -- -H 0.0.0.0" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Start the tunnel:" -ForegroundColor White
Write-Host "   cloudflared tunnel run lifeos" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Update OAuth redirect URIs:" -ForegroundColor White
Write-Host "   Spotify: https://lifeos-api.trycloudflare.com/api/spotify/callback" -ForegroundColor Gray
Write-Host "   Google:  https://lifeos-api.trycloudflare.com/api/google/callback" -ForegroundColor Gray
Write-Host ""
Write-Host "5. Access your app:" -ForegroundColor White
Write-Host "   Local:  http://192.168.4.28:3000" -ForegroundColor Gray
Write-Host "   Remote: https://lifeos-app.trycloudflare.com" -ForegroundColor Gray
Write-Host ""
Write-Host "To install as a Windows service (auto-start on boot):" -ForegroundColor Yellow
Write-Host "   cloudflared service install" -ForegroundColor Gray
Write-Host "   cloudflared service start" -ForegroundColor Gray
Write-Host ""
Write-Host "For detailed documentation, see: CLOUDFLARE_SETUP.md" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
