# PATH 새로고침 후 개발 서버 시작
# PowerShell에서 실행: .\refresh-path-and-start.ps1

Write-Host "=== PATH 새로고침 및 개발 서버 시작 ===" -ForegroundColor Cyan
Write-Host ""

# PATH 새로고침
Write-Host "[1] PATH 환경 변수 새로고침 중..." -ForegroundColor Yellow
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
Write-Host "  OK" -ForegroundColor Green

# Node.js 확인
Write-Host ""
Write-Host "[2] Node.js 확인 중..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version 2>&1
    Write-Host "  OK: Node.js $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: Node.js를 찾을 수 없습니다" -ForegroundColor Red
    Write-Host "  PowerShell을 완전히 닫고 새로 열어보세요" -ForegroundColor Yellow
    exit 1
}

# npx 확인
Write-Host ""
Write-Host "[3] npx 확인 중..." -ForegroundColor Yellow
try {
    $npxVersion = npx --version 2>&1
    Write-Host "  OK: npx $npxVersion" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: npx를 찾을 수 없습니다" -ForegroundColor Red
    exit 1
}

# 프로젝트 디렉토리로 이동
Set-Location "C:\projects\stock_calc"

Write-Host ""
Write-Host "[4] 개발 서버 시작 중..." -ForegroundColor Yellow
Write-Host ""
Write-Host "=" * 50 -ForegroundColor Cyan
Write-Host "개발 서버가 시작되면:" -ForegroundColor Green
Write-Host "  1. QR 코드가 표시됩니다" -ForegroundColor White
Write-Host "  2. 앱에서 'Fetch development servers' 버튼 클릭" -ForegroundColor White
Write-Host "  3. 또는 QR 코드 스캔" -ForegroundColor White
Write-Host ""
Write-Host "서버를 중지하려면 Ctrl+C를 누르세요" -ForegroundColor Yellow
Write-Host "=" * 50 -ForegroundColor Cyan
Write-Host ""

# 개발 서버 시작
npx expo start --dev-client
