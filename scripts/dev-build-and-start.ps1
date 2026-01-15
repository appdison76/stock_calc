# 개발 빌드 설치 및 터널 모드 서버 자동 시작
# 사용법: .\scripts\dev-build-and-start.ps1

Write-Host "`n=== 개발 빌드 설치 및 서버 시작 ===" -ForegroundColor Cyan

# 프로젝트 루트로 이동
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

# 1. 기존 Expo 서버 종료
Write-Host "`n[1/4] 기존 서버 종료 중..." -ForegroundColor Yellow
Get-Process | Where-Object {$_.ProcessName -like "*node*"} | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

# 2. 개발 빌드 설치
Write-Host "`n[2/4] 개발 빌드 설치 중..." -ForegroundColor Green
Set-Location android
& .\gradlew.bat installDebug

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n❌ 설치 실패" -ForegroundColor Red
    Set-Location $projectRoot
    exit 1
}

Set-Location $projectRoot
Write-Host "✓ 개발 빌드 설치 완료" -ForegroundColor Green

# 3. 터널 모드 서버 시작
Write-Host "`n[3/4] 터널 모드 서버 시작 중..." -ForegroundColor Green
Write-Host "터널 모드로 시작하면 WiFi IP 문제 없이 연결할 수 있습니다." -ForegroundColor Cyan
Write-Host "서버가 시작되면 터미널에 QR 코드가 표시됩니다." -ForegroundColor Cyan
Write-Host "앱에서 'Fetch development servers' 버튼을 눌러 연결하세요.`n" -ForegroundColor Yellow

# 백그라운드에서 서버 시작
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectRoot'; npm start" -WindowStyle Normal

Start-Sleep -Seconds 3

Write-Host "`n[4/4] 완료!" -ForegroundColor Green
Write-Host "`n=== 다음 단계 ===" -ForegroundColor Cyan
Write-Host "1. 새로 열린 PowerShell 창에서 QR 코드 확인" -ForegroundColor White
Write-Host "2. 앱에서 'Fetch development servers' 버튼 클릭" -ForegroundColor White
Write-Host "3. 또는 QR 코드를 스캔하여 연결" -ForegroundColor White
Write-Host "`n서버를 중지하려면 새로 열린 PowerShell 창을 닫으세요.`n" -ForegroundColor Yellow











