# Deploy backend to Cloud Run with Secret Manager integration
# Run setup-secrets.ps1 first!

Write-Host "Deploying LifeOS backend with Secret Manager..."

# Check if env vars file exists
if (-not (Test-Path "backend\.env.yaml")) {
    Write-Host "Config file not found! Run .\setup-secrets.ps1 first" -ForegroundColor Red
    exit 1
}

# Build the --set-secrets flag (environment variables)
$secretMappings = @(
    'GARMIN_PASSWORD=garmin-password:latest',
    'GARMIN_EMAIL=garmin-email:latest',
    'SPOTIFY_CLIENT_SECRET=spotify-client-secret:latest',
    'SPOTIFY_CLIENT_ID=spotify-client-id:latest',
    'MONZO_CLIENT_SECRET=monzo-client-secret:latest',
    'MONZO_CLIENT_ID=monzo-client-id:latest',
    'OPENWEATHER_API_KEY=openweather-api-key:latest',
    'GOOGLE_GEOCODING_API_KEY=google-geocoding-api-key:latest',
    'HA_TOKEN=ha-token:latest',
    'TRANSPORT_APP_KEY=transport-app-key:latest'
)

$secretsString = $secretMappings -join ","

Write-Host "Mounting secrets from Secret Manager..." -ForegroundColor Green
Write-Host "Deploying container..." -ForegroundColor Green

# Deploy with secrets as environment variables first
# Note: File mounts need to be configured separately via Cloud Console
gcloud run deploy lifeos-backend `
    --source . `
    --region europe-west2 `
    --allow-unauthenticated `
    --port 8080 `
    --env-vars-file backend\.env.yaml `
    --set-secrets $secretsString

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nDeployment successful!" -ForegroundColor Green
    Write-Host "Secrets are encrypted and securely mounted" -ForegroundColor Green
    Write-Host "Service URL: https://lifeos-backend-169224623655.europe-west2.run.app" -ForegroundColor Cyan
} else {
    Write-Host "`nDeployment failed!" -ForegroundColor Red
}

# Clean up temp file
# Remove-Item backend\.env.yaml -ErrorAction SilentlyContinue
