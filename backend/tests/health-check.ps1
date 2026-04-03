#!/usr/bin/env pwsh
# LifeOS Health Check Script
# Tests if backend and frontend are working correctly

Write-Host "`n🏥 LifeOS Health Check" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan

$allPassed = $true

# Function to test an endpoint
function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Url,
        [int]$ExpectedStatus = 200
    )
    
    Write-Host "`n🔍 Testing: $Name" -ForegroundColor Yellow
    Write-Host "   URL: $Url" -ForegroundColor Gray
    
    try {
        $response = Invoke-WebRequest -Uri $Url -TimeoutSec 5 -ErrorAction Stop
        if ($response.StatusCode -eq $ExpectedStatus) {
            Write-Host "   ✓ PASS - Status: $($response.StatusCode)" -ForegroundColor Green
            return $true
        } else {
            Write-Host "   ✗ FAIL - Expected: $ExpectedStatus, Got: $($response.StatusCode)" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "   ✗ FAIL - Error: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Function to test JSON endpoint
function Test-JsonEndpoint {
    param(
        [string]$Name,
        [string]$Url,
        [string[]]$ExpectedFields
    )
    
    Write-Host "`n🔍 Testing: $Name" -ForegroundColor Yellow
    Write-Host "   URL: $Url" -ForegroundColor Gray
    
    try {
        $response = Invoke-RestMethod -Uri $Url -TimeoutSec 5 -ErrorAction Stop
        
        $missingFields = @()
        foreach ($field in $ExpectedFields) {
            if (-not ($response.PSObject.Properties.Name -contains $field)) {
                $missingFields += $field
            }
        }
        
        if ($missingFields.Count -eq 0) {
            Write-Host "   ✓ PASS - All expected fields present" -ForegroundColor Green
            Write-Host "   Fields: $($ExpectedFields -join ', ')" -ForegroundColor Gray
            return $true
        } else {
            Write-Host "   ✗ FAIL - Missing fields: $($missingFields -join ', ')" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "   ✗ FAIL - Error: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Backend Tests
Write-Host "`n━━━ Backend Tests (Port 8080) ━━━" -ForegroundColor Cyan

$result = Test-Endpoint "Backend API Docs" "http://192.168.4.28:8080/docs"
$allPassed = $allPassed -and $result

$result = Test-JsonEndpoint "User Config Endpoint" "http://192.168.4.28:8080/api/user/config" @("morning_bus_stops", "evening_bus_stops", "home_address", "work_address")
$allPassed = $allPassed -and $result

$result = Test-JsonEndpoint "Bus Stops Endpoint" "http://192.168.4.28:8080/api/bus/stops" @("stops")
$allPassed = $allPassed -and $result

$result = Test-JsonEndpoint "Bus Locations Endpoint" "http://192.168.4.28:8080/api/bus/locations" @("locations")
$allPassed = $allPassed -and $result

$result = Test-JsonEndpoint "Weather Endpoint" "http://192.168.4.28:8080/api/weather/current" @("cities")
$allPassed = $allPassed -and $result

# Test geocoding endpoint (optional - may not be available on older backend versions)
Write-Host "`n🔍 Testing: Geocoding Endpoint (Optional)" -ForegroundColor Yellow
Write-Host "   URL: http://192.168.4.28:8080/api/user/geocode?address=Birmingham, UK" -ForegroundColor Gray
try {
    $geocodeResponse = Invoke-RestMethod -Uri "http://192.168.4.28:8080/api/user/geocode?address=Birmingham, UK" -TimeoutSec 5 -ErrorAction Stop
    if ($geocodeResponse.success -eq $true -and $geocodeResponse.latitude -and $geocodeResponse.longitude) {
        Write-Host "   ✓ PASS - Geocoding working (lat: $($geocodeResponse.latitude), lon: $($geocodeResponse.longitude))" -ForegroundColor Green
    } else {
        Write-Host "   ⚠ WARN - Geocoding endpoint exists but returned incomplete data" -ForegroundColor Yellow
    }
} catch {
    if ($_.Exception.Message -match "404") {
        Write-Host "   ⚠ SKIP - Geocoding endpoint not available (restart backend to enable)" -ForegroundColor Yellow
    } else {
        Write-Host "   ✗ FAIL - Error: $($_.Exception.Message)" -ForegroundColor Red
        $allPassed = $false
    }
}

# Frontend Tests
Write-Host "`n━━━ Frontend Tests (Port 3000) ━━━" -ForegroundColor Cyan

$result = Test-Endpoint "Frontend Homepage" "http://192.168.4.28:3000"
$allPassed = $allPassed -and $result

# Test frontend by checking if it loads (skip checking specific chunk files as they change)
Write-Host "`n🔍 Testing: Frontend Content" -ForegroundColor Yellow
Write-Host "   URL: http://192.168.4.28:3000" -ForegroundColor Gray
try {
    $frontendResponse = Invoke-WebRequest -Uri "http://192.168.4.28:3000" -TimeoutSec 5 -ErrorAction Stop
    if ($frontendResponse.Content -match "LifeOS|life-os" -or $frontendResponse.Content -match "_next") {
        Write-Host "   ✓ PASS - Frontend content loads correctly" -ForegroundColor Green
    } else {
        Write-Host "   ⚠ WARN - Frontend loads but content may be unexpected" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ✗ FAIL - Error: $($_.Exception.Message)" -ForegroundColor Red
    $allPassed = $false
}

# Port Check
Write-Host "`n━━━ Port Status ━━━" -ForegroundColor Cyan

$backend = Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue
$frontend = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue

if ($backend) {
    Write-Host "   ✓ Backend listening on port 8080 (PID: $($backend[0].OwningProcess))" -ForegroundColor Green
} else {
    Write-Host "   ✗ Backend NOT listening on port 8080" -ForegroundColor Red
    $allPassed = $false
}

if ($frontend) {
    Write-Host "   ✓ Frontend listening on port 3000 (PID: $($frontend[0].OwningProcess))" -ForegroundColor Green
} else {
    Write-Host "   ✗ Frontend NOT listening on port 3000" -ForegroundColor Red
    $allPassed = $false
}

# Summary
Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
if ($allPassed) {
    Write-Host "✅ ALL TESTS PASSED" -ForegroundColor Green
    Write-Host "   LifeOS is healthy and ready to use!" -ForegroundColor White
} else {
    Write-Host "❌ SOME TESTS FAILED" -ForegroundColor Red
    Write-Host "   Please check the errors above." -ForegroundColor White
}
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Cyan

exit $(if ($allPassed) { 0 } else { 1 })
