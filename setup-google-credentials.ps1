# Setup Google OAuth credentials.json in Secret Manager
Write-Host "Adding Google OAuth credentials to Secret Manager..." -ForegroundColor Cyan

$credentialsFile = "backend\credentials.json"

if (-not (Test-Path $credentialsFile)) {
    Write-Host "credentials.json not found at $credentialsFile" -ForegroundColor Red
    exit 1
}

# Read the file content
$credentialsContent = Get-Content $credentialsFile -Raw

# Create/update secret
$secretName = "google-oauth-credentials"

Write-Host "Creating secret: $secretName" -ForegroundColor Yellow

$exists = gcloud secrets describe $secretName 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "Secret exists, adding new version..." -ForegroundColor Gray
    echo $credentialsContent | gcloud secrets versions add $secretName --data-file=-
} else {
    Write-Host "Creating new secret..." -ForegroundColor Gray
    echo $credentialsContent | gcloud secrets create $secretName --data-file=- --replication-policy="automatic"
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to create/update secret" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Google OAuth credentials added to Secret Manager" -ForegroundColor Green
Write-Host ""
Write-Host "The secret will be mounted as a file in Cloud Run at:" -ForegroundColor Cyan
Write-Host "  /app/backend/credentials.json" -ForegroundColor White
Write-Host ""
Write-Host "Run .\deploy-backend-with-secrets.ps1 to deploy with the updated configuration" -ForegroundColor Yellow
