#!/usr/bin/env pwsh
# LifeOS Stop Script
# Stops all backend and frontend servers

Write-Host "🛑 Stopping LifeOS..." -ForegroundColor Cyan

$stopped = $false

# Stop Backend (Port 8000)
$backendPort = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
if ($backendPort) {
    Write-Host "   Stopping Backend (PID: $($backendPort[0].OwningProcess))..." -ForegroundColor Yellow
    Stop-Process -Id $backendPort[0].OwningProcess -Force -ErrorAction SilentlyContinue
    Write-Host "   ✓ Backend stopped" -ForegroundColor Green
    $stopped = $true
} else {
    Write-Host "   Backend not running" -ForegroundColor Gray
}

# Stop Frontend (Port 3000)
$frontendPort = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if ($frontendPort) {
    Write-Host "   Stopping Frontend (PID: $($frontendPort[0].OwningProcess))..." -ForegroundColor Yellow
    Stop-Process -Id $frontendPort[0].OwningProcess -Force -ErrorAction SilentlyContinue
    Write-Host "   ✓ Frontend stopped" -ForegroundColor Green
    $stopped = $true
} else {
    Write-Host "   Frontend not running" -ForegroundColor Gray
}

# Stop Cloudflare Tunnel
$tunnelProcess = Get-Process -Name cloudflared -ErrorAction SilentlyContinue
if ($tunnelProcess) {
    Write-Host "   Stopping Cloudflare Tunnel (PID: $($tunnelProcess.Id))..." -ForegroundColor Yellow
    Stop-Process -Name cloudflared -Force -ErrorAction SilentlyContinue
    Write-Host "   ✓ Cloudflare Tunnel stopped" -ForegroundColor Green
    $stopped = $true
} else {
    Write-Host "   Cloudflare Tunnel not running" -ForegroundColor Gray
}

# Also kill any stray node/python processes
Write-Host "`n   Cleaning up stray processes..." -ForegroundColor Yellow
Get-Process | Where-Object { $_.ProcessName -eq "node" -and $_.MainWindowTitle -eq "" } | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process | Where-Object { $_.ProcessName -eq "python" -and $_.CommandLine -like "*uvicorn*" } | Stop-Process -Force -ErrorAction SilentlyContinue

if ($stopped) {
    Write-Host "`n✅ LifeOS Stopped" -ForegroundColor Green
} else {
    Write-Host "`n⚠️  LifeOS was not running" -ForegroundColor Yellow
}
