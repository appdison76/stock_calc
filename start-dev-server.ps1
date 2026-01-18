# 개발 서버 시작 스크립트
# PowerShell을 새로 열어서 실행하세요

Write-Host "=== 개발 서버 시작 ===" -ForegroundColor Cyan
Write-Host ""

# PATH 새로고침
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Node.js 확인
Write-Host "[1] Node.js 확인..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version 2>&1
    Write-Host "  OK: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: Node.js not found" -ForegroundColor Red
    Write-Host "  PowerShell을 새로 열고 다시 시도하세요." -ForegroundColor Yellow
    exit 1
}

# 프로젝트 디렉토리로 이동
Set-Location "C:\projects\stock_calc"

# 개발 서버 시작
Write-Host ""
Write-Host "[2] 개발 서버 시작 중..." -ForegroundColor Yellow
Write-Host "  명령어: npx expo start --dev-client" -ForegroundColor Cyan
Write-Host ""
Write-Host "서버가 시작되면:" -ForegroundColor Green
Write-Host "  1. QR 코드가 표시됩니다" -ForegroundColor White
Write-Host "  2. 앱에서 'Fetch development servers' 버튼 클릭" -ForegroundColor White
Write-Host "  3. 또는 QR 코드 스캔" -ForegroundColor White
Write-Host ""
Write-Host "서버를 중지하려면 Ctrl+C를 누르세요" -ForegroundColor Yellow
Write-Host ""
Write-Host "=" * 50 -ForegroundColor Cyan
Write-Host ""

npx expo start --dev-client
