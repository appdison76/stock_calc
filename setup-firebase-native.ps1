# Firebase Native Setup Script

Write-Host "Firebase native setup starting..." -ForegroundColor Cyan

# Check google-services.json file
$googleServicesPath = "android/app/google-services.json"
if (-not (Test-Path $googleServicesPath)) {
    Write-Host "ERROR: google-services.json file not found!" -ForegroundColor Red
    Write-Host "File location: $googleServicesPath" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Please follow these steps:" -ForegroundColor Yellow
    Write-Host "1. Firebase Console -> Project Settings -> General tab" -ForegroundColor White
    Write-Host "2. Select Android app in 'Your apps' section" -ForegroundColor White
    Write-Host "3. Download 'google-services.json'" -ForegroundColor White
    Write-Host "4. Save file to android/app/google-services.json" -ForegroundColor White
    exit 1
}

Write-Host "OK: google-services.json file found" -ForegroundColor Green

# Regenerate native files
Write-Host ""
Write-Host "Regenerating native files..." -ForegroundColor Cyan
npx expo prebuild --clean

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: prebuild failed!" -ForegroundColor Red
    exit 1
}

Write-Host "OK: Native files regenerated" -ForegroundColor Green
Write-Host ""
Write-Host "Next step: npx expo run:android" -ForegroundColor Yellow
