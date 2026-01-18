# npx 실행 정책 문제 해결 스크립트
# 관리자 권한으로 실행 필요할 수 있습니다

Write-Host "=== npx 실행 정책 문제 해결 ===" -ForegroundColor Cyan
Write-Host ""

# 현재 실행 정책 확인
Write-Host "[1] 현재 실행 정책 확인..." -ForegroundColor Yellow
$currentPolicy = Get-ExecutionPolicy
Write-Host "  현재 정책: $currentPolicy" -ForegroundColor $(if ($currentPolicy -eq "RemoteSigned" -or $currentPolicy -eq "Unrestricted") { "Green" } else { "Yellow" })

# 실행 정책 변경 (현재 사용자에 대해서만)
Write-Host ""
Write-Host "[2] 실행 정책 변경 시도..." -ForegroundColor Yellow
try {
    Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
    Write-Host "  OK: 실행 정책이 RemoteSigned로 변경되었습니다" -ForegroundColor Green
} catch {
    Write-Host "  경고: 실행 정책 변경 실패 (관리자 권한 필요할 수 있음)" -ForegroundColor Yellow
    Write-Host "  대신 npx.cmd를 직접 사용하거나 수동으로 설정하세요:" -ForegroundColor Cyan
    Write-Host "  Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser" -ForegroundColor White
}

# npx 확인
Write-Host ""
Write-Host "[3] npx 확인..." -ForegroundColor Yellow
try {
    $npxVersion = npx --version 2>&1
    Write-Host "  OK: npx $npxVersion" -ForegroundColor Green
} catch {
    Write-Host "  경고: npx.ps1 실행 실패" -ForegroundColor Yellow
    Write-Host "  npx.cmd를 직접 사용하세요:" -ForegroundColor Cyan
    Write-Host "  & `"C:\Program Files\nodejs\npx.cmd`" expo start --dev-client" -ForegroundColor White
}

Write-Host ""
Write-Host "완료!" -ForegroundColor Green
