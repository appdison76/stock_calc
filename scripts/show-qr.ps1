# QR 코드 표시 스크립트
# 사용법: .\scripts\show-qr.ps1

Write-Host "`n=== QR 코드 생성 ===" -ForegroundColor Cyan

# IP 주소 가져오기
$ipAddress = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -like "192.168.*" }).IPAddress | Select-Object -First 1

if (-not $ipAddress) {
    Write-Host "❌ 로컬 네트워크 IP 주소를 찾을 수 없습니다." -ForegroundColor Red
    exit 1
}

$url = "exp://$ipAddress:8081"
Write-Host "`n서버 URL: $url" -ForegroundColor Green
Write-Host "`nQR 코드를 생성하려면 다음 URL을 브라우저에서 열거나," -ForegroundColor Yellow
Write-Host "온라인 QR 코드 생성기에 입력하세요:" -ForegroundColor Yellow
Write-Host "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=$url" -ForegroundColor Cyan

Write-Host "`n또는 터미널에서 다음 명령어를 실행하세요:" -ForegroundColor Yellow
Write-Host "npm start -- --lan" -ForegroundColor Green
Write-Host "`n터미널에 QR 코드가 자동으로 표시됩니다." -ForegroundColor Cyan















