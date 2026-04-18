#!/usr/bin/env pwsh
# LifeOS Startup Script
# Starts both backend and frontend servers

Write-Host "🚀 Starting LifeOS..." -ForegroundColor Cyan

# Check and start Home Assistant Docker container
Write-Host "`n🏠 Checking Home Assistant Docker container..." -ForegroundColor Cyan
try {
    # Check if Docker is running
    $dockerRunning = docker info 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "⚠️  Docker is not running. Please start Docker Desktop." -ForegroundColor Yellow
    } else {
        # Check if home-assistant container exists and its status
        $containerStatus = docker ps -a --filter "name=home-assistant" --format "{{.Status}}" 2>$null
        
        if ([string]::IsNullOrEmpty($containerStatus)) {
            Write-Host "⚠️  Home Assistant container not found." -ForegroundColor Yellow
            Write-Host "   Create it with: docker run -d --name home-assistant ..." -ForegroundColor Gray
        } elseif ($containerStatus -like "Up*") {
            Write-Host "✓ Home Assistant is already running" -ForegroundColor Green
        } else {
            Write-Host "⏳ Starting Home Assistant container..." -ForegroundColor Yellow
            docker start home-assistant | Out-Null
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✓ Home Assistant started successfully" -ForegroundColor Green
            } else {
                Write-Host "⚠️  Failed to start Home Assistant" -ForegroundColor Yellow
            }
        }
    }
} catch {
    Write-Host "⚠️  Could not check Docker status: $_" -ForegroundColor Yellow
}

# Check and start Cloudflare Tunnel
# Write-Host "`n☁️  Checking Cloudflare Tunnel..." -ForegroundColor Cyan
# try {
#     # Check if cloudflared is installed
#     $cloudflaredExists = Get-Command cloudflared -ErrorAction SilentlyContinue
#     if (-not $cloudflaredExists) {
#         Write-Host "⚠️  cloudflared is not installed or not in PATH" -ForegroundColor Yellow
#     } else {
#         # Check if tunnel is already running
#         $tunnelProcess = Get-Process -Name cloudflared -ErrorAction SilentlyContinue
        
#         if ($tunnelProcess) {
#             Write-Host "✓ Cloudflare tunnel is already running" -ForegroundColor Green
#         } else {
#             Write-Host "⏳ Starting Cloudflare tunnel (lifeos2)..." -ForegroundColor Yellow
#             $tunnelJob = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot'; cloudflared tunnel run lifeos2" -PassThru -WindowStyle Minimized
#             Start-Sleep -Seconds 3
            
#             # Verify tunnel started
#             $tunnelCheck = Get-Process -Name cloudflared -ErrorAction SilentlyContinue
#             if ($tunnelCheck) {
#                 Write-Host "✓ Cloudflare tunnel started successfully (PID: $($tunnelJob.Id))" -ForegroundColor Green
#             } else {
#                 Write-Host "⚠️  Failed to start Cloudflare tunnel" -ForegroundColor Yellow
#             }
#         }
#     }
# } catch {
#     Write-Host "⚠️  Could not check Cloudflare tunnel status: $_" -ForegroundColor Yellow
# }

# Check if ports are already in use
$backendPort = Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue
$frontendPort = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue

if ($backendPort) {
    Write-Host "⚠️  Port 8080 already in use (Backend)" -ForegroundColor Yellow
    $response = Read-Host "Kill existing process? (y/n)"
    if ($response -eq 'y') {
        Stop-Process -Id $backendPort.OwningProcess -Force
        Write-Host "✓ Killed process on port 8080" -ForegroundColor Green
        Start-Sleep -Seconds 2
    }
}

if ($frontendPort) {
    Write-Host "⚠️  Port 3000 already in use (Frontend)" -ForegroundColor Yellow
    $response = Read-Host "Kill existing process? (y/n)"
    if ($response -eq 'y') {
        Stop-Process -Id $frontendPort.OwningProcess -Force
        Write-Host "✓ Killed process on port 3000" -ForegroundColor Green
        Start-Sleep -Seconds 2
    }
}

# Start Backend
Write-Host "`n📦 Starting Backend Server (Port 8080)..." -ForegroundColor Cyan
$backendJob = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot'; & '.\venv\Scripts\python.exe' -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8080" -PassThru
Write-Host "✓ Backend starting (PID: $($backendJob.Id))" -ForegroundColor Green

# Wait for backend to be ready
Write-Host "⏳ Waiting for backend to start..." -ForegroundColor Yellow
$maxAttempts = 10
$attempt = 0
$backendReady = $false

while ($attempt -lt $maxAttempts -and -not $backendReady) {
    Start-Sleep -Seconds 1
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8080/docs" -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            $backendReady = $true
        }
    } catch {
        # Backend not ready yet
    }
    $attempt++
    Write-Host "." -NoNewline
}

if ($backendReady) {
    Write-Host "`n✓ Backend is ready!" -ForegroundColor Green
} else {
    Write-Host "`n⚠️  Backend may not be ready yet (timeout)" -ForegroundColor Yellow
}

# Start Frontend
Write-Host "`n🎨 Starting Frontend Server (Port 3000)..." -ForegroundColor Cyan
$frontendJob = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\frontend'; npm run dev" -PassThru
Write-Host "✓ Frontend starting (PID: $($frontendJob.Id))" -ForegroundColor Green

# Wait for frontend to be ready
Write-Host "⏳ Waiting for frontend to start..." -ForegroundColor Yellow
$attempt = 0
$frontendReady = $false

while ($attempt -lt $maxAttempts -and -not $frontendReady) {
    Start-Sleep -Seconds 1
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3001" -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            $frontendReady = $true
        }
    } catch {
        # Frontend not ready yet
    }
    $attempt++
    Write-Host "." -NoNewline
}

if ($frontendReady) {
    Write-Host "`n✓ Frontend is ready!" -ForegroundColor Green
} else {
    Write-Host "`n⚠️  Frontend may not be ready yet (timeout)" -ForegroundColor Yellow
}

Write-Host "`n✅ LifeOS Started!" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "LOCAL URLS:" -ForegroundColor Yellow
Write-Host "Backend:        http://localhost:8080/docs" -ForegroundColor White
Write-Host "Frontend:       http://localhost:3001" -ForegroundColor White

# Check Home Assistant status and display URL
$haStatus = docker ps --filter "name=home-assistant" --format "{{.Status}}" 2>$null
if ($haStatus -like "Up*") {
    Write-Host "Home Assistant: http://localhost:8123" -ForegroundColor White
}

# Check if Cloudflare tunnel is running and display public URLs
# $tunnelRunning = Get-Process -Name cloudflared -ErrorAction SilentlyContinue
# if ($tunnelRunning) {
#     Write-Host "`nPUBLIC URLS (via Cloudflare):" -ForegroundColor Yellow
#     Write-Host "Backend:        https://api.life-os-dashboard.com" -ForegroundColor Cyan
#     Write-Host "Frontend:       https://life-os-dashboard.com" -ForegroundColor Cyan
# }

# Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
# Write-Host "`nPress any key to run health checks..." -ForegroundColor Yellow
# $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# Run health checks
& "$PSScriptRoot\health-check.ps1"
