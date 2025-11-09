@echo off
:: Check for admin rights
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo This script requires administrator privileges.
    echo Please right-click and select "Run as administrator"
    pause
    exit /b 1
)

echo Installing OpenSSL via Chocolatey...
echo.

:: Check if chocolatey is installed
where choco >nul 2>&1
if %errorLevel% neq 0 (
    echo Chocolatey is not installed. Installing Chocolatey first...
    echo.
    powershell -NoProfile -ExecutionPolicy Bypass -Command "iex ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))"
    
    :: Refresh environment variables
    call refreshenv
)

:: Install OpenSSL
echo Installing OpenSSL...
choco install openssl -y

if %errorLevel% equ 0 (
    echo.
    echo ✓ OpenSSL installed successfully!
    echo.
    echo Now run: python backend/generate_ssl_cert.py
) else (
    echo.
    echo ✗ Failed to install OpenSSL
    echo Please install manually from: https://slproweb.com/products/Win32OpenSSL.html
)

pause
