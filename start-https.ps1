# Run backend with HTTPS using uvicorn

$env:PYTHONPATH = "D:\Personal\Coding\life-os"

Write-Host "Starting LifeOS Backend with HTTPS..." -ForegroundColor Green
Write-Host "Make sure you've updated your Spotify app redirect URI to:" -ForegroundColor Yellow
Write-Host "  https://localhost:8000/api/spotify/callback" -ForegroundColor Cyan
Write-Host ""

D:/Personal/Coding/life-os/venv/Scripts/python.exe -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000 --ssl-keyfile backend/key.pem --ssl-certfile backend/cert.pem
