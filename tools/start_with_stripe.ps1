<#
Simple helper to start the local server with Stripe test keys.
Usage: run this in PowerShell from the repo root:
  .\tools\start_with_stripe.ps1
This script will prompt for keys if they are not present in the environment.
#>

Set-StrictMode -Version Latest

# Prompt helper for secure input
function Read-Secret([string]$prompt) {
    $s = Read-Host -AsSecureString $prompt
    return [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s))
}

Write-Host "Starting SACHDEVA OPTICALS with Stripe (test) support..." -ForegroundColor Cyan

if (-not $env:STRIPE_SECRET) {
    $env:STRIPE_SECRET = Read-Secret 'Enter STRIPE_SECRET (sk_test_...)'
} else { Write-Host "Using existing STRIPE_SECRET from environment" -ForegroundColor Yellow }

if (-not $env:STRIPE_PUBLISHABLE) {
    $env:STRIPE_PUBLISHABLE = Read-Host 'Enter STRIPE_PUBLISHABLE (pk_test_...)'
} else { Write-Host "Using existing STRIPE_PUBLISHABLE from environment" -ForegroundColor Yellow }

if (-not $env:DATABASE_URL) {
    $env:DATABASE_URL = Read-Host "Enter DATABASE_URL (postgres://user:pass@host:port/db) or press Enter to use default local"
    if (-not $env:DATABASE_URL) { $env:DATABASE_URL = 'postgres://shop_user:Sachdeva2368@localhost:5432/sachdeva_opticals_website' }
} else { Write-Host "Using existing DATABASE_URL from environment" -ForegroundColor Yellow }

if (-not $env:JWT_SECRET) {
    $env:JWT_SECRET = Read-Host 'Enter JWT_SECRET (press Enter to auto-generate)'
    if (-not $env:JWT_SECRET) { $env:JWT_SECRET = [guid]::NewGuid().ToString(); Write-Host "Generated JWT_SECRET" -ForegroundColor Green }
} else { Write-Host "Using existing JWT_SECRET from environment" -ForegroundColor Yellow }

Write-Host "Environment ready. Starting server..." -ForegroundColor Green

# Start server in current shell so logs are visible
cd $PSScriptRoot\..\
# Clear previous node processes related to this project? We avoid killing processes automatically.
npm start
