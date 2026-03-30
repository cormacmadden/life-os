# Simple deployment - just build and push, configure secrets in Console UI
Write-Host "Simple deployment to Cloud Run" -ForegroundColor Cyan
Write-Host ""
Write-Host "This will deploy the code. Configure secrets in the Cloud Console:" -ForegroundColor Yellow
Write-Host "https://console.cloud.google.com/run/detail/europe-west2/lifeos-backend/edit" -ForegroundColor Cyan
Write-Host ""

gcloud run deploy lifeos-backend `
    --source . `
    --region europe-west2 `
    --allow-unauthenticated `
    --port 8080

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nDeployment successful!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Now configure secrets in Cloud Console:" -ForegroundColor Yellow
    Write-Host "1. Go to: https://console.cloud.google.com/run/detail/europe-west2/lifeos-backend/edit" -ForegroundColor White
    Write-Host "2. Click 'Variables & Secrets' tab" -ForegroundColor White
    Write-Host "3. Reference secrets as environment variables" -ForegroundColor White
    Write-Host "4. Mount 'google-oauth-credentials' as file at: /app/backend/credentials.json" -ForegroundColor White
    Write-Host "5. Click 'DEPLOY'" -ForegroundColor White
} else {
    Write-Host "`nDeployment failed!" -ForegroundColor Red
}
