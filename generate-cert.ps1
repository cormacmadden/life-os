# Generate Self-Signed SSL Certificate for Local Development
# This PowerShell script creates cert.pem and key.pem files

Write-Host "Generating self-signed SSL certificate..." -ForegroundColor Green

# Create a self-signed certificate
$cert = New-SelfSignedCertificate `
    -DnsName "localhost", "127.0.0.1" `
    -CertStoreLocation "Cert:\CurrentUser\My" `
    -NotAfter (Get-Date).AddYears(1) `
    -KeyAlgorithm RSA `
    -KeyLength 2048

# Export to PFX with a temporary password
$password = ConvertTo-SecureString -String "temp" -Force -AsPlainText
$pfxPath = "backend\temp.pfx"
Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $password | Out-Null

# Convert PFX to PEM format using OpenSSL (if available) or export directly
$certPath = "backend\cert.pem"
$keyPath = "backend\key.pem"

# Export certificate
$certBytes = $cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)
$certPem = "-----BEGIN CERTIFICATE-----`n"
$certPem += [System.Convert]::ToBase64String($certBytes, [System.Base64FormattingOptions]::InsertLineBreaks)
$certPem += "`n-----END CERTIFICATE-----"
Set-Content -Path $certPath -Value $certPem

Write-Host "✓ Certificate created: $certPath" -ForegroundColor Cyan

# For the private key, we need to export from the PFX
# This requires openssl or we can provide instructions
Write-Host "`nTo extract the private key, run:" -ForegroundColor Yellow
Write-Host "openssl pkcs12 -in backend\temp.pfx -nocerts -out backend\key.pem -nodes -password pass:temp" -ForegroundColor White
Write-Host "`nOr manually:" -ForegroundColor Yellow
Write-Host "1. Double-click backend\temp.pfx" -ForegroundColor White
Write-Host "2. Import to 'Current User' store" -ForegroundColor White
Write-Host "3. Mark as exportable" -ForegroundColor White

# Clean up certificate from store
Remove-Item -Path "Cert:\CurrentUser\My\$($cert.Thumbprint)" -Force

Write-Host "`nNote: The temp.pfx file contains both certificate and key." -ForegroundColor Gray
Write-Host "Password is: temp" -ForegroundColor Gray
