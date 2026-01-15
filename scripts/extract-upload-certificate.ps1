# 업로드 인증서(PEM) 추출 스크립트
# 기존 keystore에서 Google Play Console에 등록할 업로드 인증서를 추출합니다.

$ErrorActionPreference = "Stop"

# gradle.properties에서 비밀번호 읽기
$gradlePropsPath = Join-Path $PSScriptRoot "..\android\gradle.properties"
if (-not (Test-Path $gradlePropsPath)) {
    Write-Host "❌ gradle.properties 파일을 찾을 수 없습니다: $gradlePropsPath" -ForegroundColor Red
    exit 1
}

$gradleProps = Get-Content $gradlePropsPath | ConvertFrom-StringData
$storePassword = $gradleProps.MYAPP_RELEASE_STORE_PASSWORD
$keyAlias = $gradleProps.MYAPP_RELEASE_KEY_ALIAS
$keystorePath = Join-Path $PSScriptRoot "..\android\app\release.keystore"

if (-not $storePassword) {
    Write-Host "❌ gradle.properties에서 MYAPP_RELEASE_STORE_PASSWORD를 찾을 수 없습니다." -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $keystorePath)) {
    Write-Host "❌ Keystore 파일을 찾을 수 없습니다: $keystorePath" -ForegroundColor Red
    Write-Host "💡 EAS에서 keystore를 다운로드하거나 생성하세요." -ForegroundColor Yellow
    exit 1
}

Write-Host "📦 Keystore 정보 확인 중..." -ForegroundColor Cyan
Write-Host "   Keystore: $keystorePath" -ForegroundColor Gray
Write-Host "   Key Alias: $keyAlias" -ForegroundColor Gray
Write-Host ""

# 인증서 정보 확인
Write-Host "🔍 Keystore 인증서 정보 확인 중..." -ForegroundColor Cyan
$listCommand = "keytool -list -v -keystore `"$keystorePath`" -alias `"$keyAlias`" -storepass `"$storePassword`""
try {
    $listOutput = Invoke-Expression $listCommand 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Keystore 정보 확인 실패" -ForegroundColor Red
        Write-Host $listOutput -ForegroundColor Red
        exit 1
    }
    
    # SHA-1과 SHA-256 지문 추출
    $sha1Match = $listOutput | Select-String -Pattern "SHA1:\s+([A-F0-9:]+)"
    $sha256Match = $listOutput | Select-String -Pattern "SHA256:\s+([A-F0-9:]+)"
    
    if ($sha1Match) {
        Write-Host "   SHA-1: $($sha1Match.Matches.Groups[1].Value)" -ForegroundColor Green
    }
    if ($sha256Match) {
        Write-Host "   SHA-256: $($sha256Match.Matches.Groups[1].Value)" -ForegroundColor Green
    }
    Write-Host ""
} catch {
    Write-Host "❌ Keystore 정보 확인 중 오류 발생: $_" -ForegroundColor Red
    exit 1
}

# PEM 파일 추출
$pemPath = Join-Path $PSScriptRoot "..\android\app\upload_certificate.pem"
Write-Host "📄 업로드 인증서(PEM) 추출 중..." -ForegroundColor Cyan
Write-Host "   출력 파일: $pemPath" -ForegroundColor Gray
Write-Host ""

$exportCommand = "keytool -export -rfc -keystore `"$keystorePath`" -alias `"$keyAlias`" -file `"$pemPath`" -storepass `"$storePassword`""

try {
    $exportOutput = Invoke-Expression $exportCommand 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ 인증서 추출 실패" -ForegroundColor Red
        Write-Host $exportOutput -ForegroundColor Red
        exit 1
    }
    
    Write-Host "✅ 업로드 인증서가 성공적으로 추출되었습니다!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 다음 단계:" -ForegroundColor Yellow
    Write-Host "   1. Google Play Console 접속" -ForegroundColor White
    Write-Host "   2. 앱 서명 > 업로드 키 관리로 이동" -ForegroundColor White
    Write-Host "   3. 다음 파일을 업로드: $pemPath" -ForegroundColor White
    Write-Host ""
    Write-Host "💡 또는 SHA-1/SHA-256 지문을 직접 등록할 수도 있습니다." -ForegroundColor Cyan
    
} catch {
    Write-Host "❌ 인증서 추출 중 오류 발생: $_" -ForegroundColor Red
    exit 1
}











