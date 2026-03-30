# Setup Google Secret Manager for LifeOS
# This script creates secrets from your .env file and deploys securely

Write-Host "🔐 Setting up Google Secret Manager..." -ForegroundColor Cyan

# Enable Secret Manager API
Write-Host "`n📦 Enabling Secret Manager API..." -ForegroundColor Yellow
gcloud services enable secretmanager.googleapis.com

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to enable Secret Manager API" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Secret Manager API enabled" -ForegroundColor Green

# Define which keys are secrets (need encryption)
$secretKeys = @(
    'GARMIN_PASSWORD',
    'GARMIN_EMAIL',
    'SPOTIFY_CLIENT_SECRET',
    'SPOTIFY_CLIENT_ID',
    'MONZO_CLIENT_SECRET',
    'MONZO_CLIENT_ID',
    'MONZO_ACCESS_TOKEN',
    'OPENWEATHER_API_KEY',
    'GOOGLE_GEOCODING_API_KEY',
    'HA_TOKEN',
    'TRANSPORT_APP_KEY'
)

# Non-sensitive configs (can be env vars)
$configKeys = @(
    'TRANSPORT_APP_ID',
    'MORNING_STOPS',
    'EVENING_STOPS',
    'DATABASE_URL',
    'SPOTIFY_REDIRECT_URI',
    'MONZO_REDIRECT_URI',
    'GOOGLE_REDIRECT_URI',
    'GOOGLE_POST_LOGIN_REDIRECT'
)

# Read .env file
$envFile = Get-Content "backend\.env"
$secrets = @{}
$configs = @()

Write-Host "`nProcessing environment variables..." -ForegroundColor Yellow

foreach ($line in $envFile) {
    if ($line -match '^\s*#' -or $line -match '^\s*$') {
        continue
    }
    
    if ($line -match '^([^=]+)=(.*)$') {
        $key = $Matches[1].Trim()
        $value = $Matches[2].Trim()
        
        # Skip empty values
        if ([string]::IsNullOrWhiteSpace($value)) {
            Write-Host "Skipping $key (empty value)" -ForegroundColor Gray
            continue
        }
        
        # Skip reserved vars
        if ($key -eq 'PORT' -or $key -eq 'HOST') {
            continue
        }
        
        # Skip localhost URLs (except DATABASE_URL)
        if ($value -match 'localhost' -and $key -ne 'DATABASE_URL') {
            Write-Host "Skipping $key (localhost URL)" -ForegroundColor Gray
            continue
        }
        
        # Categorize as secret or config
        if ($secretKeys -contains $key) {
            $secrets[$key] = $value
        } elseif ($configKeys -contains $key) {
            $configs += "$key`: `"$value`""
        }
    }
}

Write-Host "`nFound:" -ForegroundColor Cyan
Write-Host "  - $($secrets.Count) secrets to encrypt" -ForegroundColor Yellow
Write-Host "  - $($configs.Count) non-sensitive configs" -ForegroundColor Yellow

# Create secrets in Secret Manager
Write-Host "`Creating secrets in Secret Manager..." -ForegroundColor Cyan

foreach ($key in $secrets.Keys) {
    $secretName = $key.ToLower().Replace('_', '-')
    $value = $secrets[$key]
    
    Write-Host "  Creating secret: $secretName" -ForegroundColor Gray
    
    # Check if secret exists
    $exists = gcloud secrets describe $secretName 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        # Secret exists, add new version
        Write-Host "    Secret exists, adding new version..." -ForegroundColor Gray
        echo $value | gcloud secrets versions add $secretName --data-file=-
    } else {
        # Create new secret
        echo $value | gcloud secrets create $secretName --data-file=- --replication-policy="automatic"
    }
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "    Failed to create secret: $secretName" -ForegroundColor Red
    } else {
        Write-Host "    Secret created: $secretName" -ForegroundColor Green
    }
}

# Create env vars file for non-sensitive configs in proper YAML format
$envVarsFile = Join-Path $PSScriptRoot "backend\.env.yaml"
if ($configs.Count -gt 0) {
    # Write proper YAML without BOM
    [System.IO.File]::WriteAllLines($envVarsFile, $configs)
    Write-Host "`nConfig file created with $($configs.Count) variables" -ForegroundColor Green
} else {
    Write-Host "`nNo config variables to write" -ForegroundColor Yellow
}

Write-Host "`nSecrets created in Secret Manager" -ForegroundColor Green

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Run the deployment script to deploy with secrets" -ForegroundColor White
Write-Host "2. Secrets will be mounted as environment variables in Cloud Run" -ForegroundColor White

Write-Host ""
Write-Host "To deploy, run: .\deploy-backend-with-secrets.ps1" -ForegroundColor Yellow
