# 빌드 환경 확인 스크립트

Write-Host "빌드 환경 확인 중...`n" -ForegroundColor Green

$allGood = $true

# Java 확인
Write-Host "[Java]" -ForegroundColor Yellow
$javaCmd = Get-Command java -ErrorAction SilentlyContinue
if ($javaCmd) {
    Write-Host "✓ Java 설치됨" -ForegroundColor Green
    java -version 2>&1 | Select-Object -First 1
} else {
    Write-Host "✗ Java가 설치되어 있지 않습니다" -ForegroundColor Red
    $allGood = $false
}

# JAVA_HOME 확인
Write-Host "`n[JAVA_HOME]" -ForegroundColor Yellow
if ($env:JAVA_HOME) {
    Write-Host "✓ JAVA_HOME: $env:JAVA_HOME" -ForegroundColor Green
} else {
    Write-Host "✗ JAVA_HOME이 설정되어 있지 않습니다" -ForegroundColor Red
    $allGood = $false
}

# ANDROID_HOME 확인
Write-Host "`n[ANDROID_HOME]" -ForegroundColor Yellow
if ($env:ANDROID_HOME) {
    Write-Host "✓ ANDROID_HOME: $env:ANDROID_HOME" -ForegroundColor Green
    if (Test-Path $env:ANDROID_HOME) {
        Write-Host "✓ Android SDK 경로가 유효합니다" -ForegroundColor Green
    } else {
        Write-Host "✗ Android SDK 경로가 존재하지 않습니다" -ForegroundColor Red
        $allGood = $false
    }
} else {
    Write-Host "✗ ANDROID_HOME이 설정되어 있지 않습니다" -ForegroundColor Red
    $allGood = $false
}

# Android SDK Tools 확인
Write-Host "`n[Android SDK Tools]" -ForegroundColor Yellow
if ($env:ANDROID_HOME) {
    $platformTools = "$env:ANDROID_HOME\platform-tools\adb.exe"
    if (Test-Path $platformTools) {
        Write-Host "✓ platform-tools 설치됨" -ForegroundColor Green
    } else {
        Write-Host "✗ platform-tools가 설치되어 있지 않습니다" -ForegroundColor Red
        $allGood = $false
    }
}

# Node.js 확인
Write-Host "`n[Node.js]" -ForegroundColor Yellow
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCmd) {
    $nodeVersion = node -v
    Write-Host "✓ Node.js 설치됨: $nodeVersion" -ForegroundColor Green
} else {
    Write-Host "✗ Node.js가 설치되어 있지 않습니다" -ForegroundColor Red
    $allGood = $false
}

# EAS CLI 확인
Write-Host "`n[EAS CLI]" -ForegroundColor Yellow
$easCmd = Get-Command eas -ErrorAction SilentlyContinue
if ($easCmd) {
    $easVersion = eas --version
    Write-Host "✓ EAS CLI 설치됨: $easVersion" -ForegroundColor Green
} else {
    Write-Host "✗ EAS CLI가 설치되어 있지 않습니다" -ForegroundColor Red
    Write-Host "  설치: npm install -g eas-cli" -ForegroundColor Cyan
    $allGood = $false
}

# 결과
Write-Host "`n" -NoNewline
if ($allGood) {
    Write-Host "✓ 모든 환경이 준비되었습니다!" -ForegroundColor Green
    Write-Host "`n로컬 빌드를 실행할 수 있습니다:" -ForegroundColor Cyan
    Write-Host "  eas build --platform android --profile preview --local" -ForegroundColor White
} else {
    Write-Host "✗ 일부 환경이 준비되지 않았습니다" -ForegroundColor Red
    Write-Host "`n설정 스크립트를 실행하세요:" -ForegroundColor Yellow
    Write-Host "  .\setup-local-build.ps1" -ForegroundColor White
}
