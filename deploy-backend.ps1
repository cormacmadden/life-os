# Deploy backend to Cloud Run with environment variables
# Run this from the project root


# Create a YAML env file for Cloud Run
$envYaml = @()
$envFile = Get-Content "backend\.env"

foreach ($line in $envFile) {
    # Skip comments and empty lines
    if ($line -match '^\s*#' -or $line -match '^\s*$') {
        continue
    }
    
    # Parse KEY=VALUE
    if ($line -match '^([^=]+)=(.*)$') {
        $key = $Matches[1].Trim()
        $value = $Matches[2].Trim()
        
        # Skip reserved Cloud Run environment variables
        if ($key -eq 'PORT' -or $key -eq 'HOST') {
            Write-Host "Skipping $key (reserved by Cloud Run)" -ForegroundColor Yellow
            continue
        }
        
        # Skip localhost URLs for production (except DATABASE_URL)
        if ($value -match 'localhost' -and $key -ne 'DATABASE_URL') {
            Write-Host "Skipping $key (localhost URL)" -ForegroundColor Yellow
            continue
        }
        
        # Add to YAML format: KEY: "VALUE"
        $envYaml += "$key`: `"$value`""
    }
}

# Write to temporary file
$tempFile = "backend\.env.yaml"
$envYaml | Out-File -FilePath $tempFile -Encoding UTF8

Write-Host "Setting environment variables..." -ForegroundColor Green
Write-Host "Total vars: $($envYaml.Count)" -ForegroundColor Cyan

# Deploy with environment variables
gcloud run deploy lifeos-backend `
    --source . `
    --region europe-west2 `
    --allow-unauthenticated `
    --port 8080 `
    --env-vars-file $tempFile

# Clean up temp file
Remove-Item $tempFile -ErrorAction SilentlyContinue

if ($LASTEXITCODE -eq 0) {
    Write-Host "Deployment successful!" -ForegroundColor Green
} else {
    Write-Host "Deployment failed!" -ForegroundColor Red
}
