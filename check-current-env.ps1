# 현재 환경 확인 스크립트
Write-Host "=== 개발 환경 확인 ===" -ForegroundColor Cyan
Write-Host ""

# 1. Node.js 확인
Write-Host "[1] Node.js 확인 중..." -ForegroundColor Yellow
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCmd) {
    $nodeVersion = node --version 2>&1
    Write-Host "  ✓ Node.js 설치됨: $nodeVersion" -ForegroundColor Green
} else {
    Write-Host "  ✗ Node.js 미설치" -ForegroundColor Red
    Write-Host "    다운로드: https://nodejs.org/" -ForegroundColor Cyan
}

# 2. npm 확인
Write-Host "[2] npm 확인 중..." -ForegroundColor Yellow
$npmCmd = Get-Command npm -ErrorAction SilentlyContinue
if ($npmCmd) {
    $npmVersion = npm --version 2>&1
    Write-Host "  ✓ npm 설치됨: $npmVersion" -ForegroundColor Green
} else {
    Write-Host "  ✗ npm 미설치" -ForegroundColor Red
}

# 3. Java 확인
Write-Host "[3] Java JDK 확인 중..." -ForegroundColor Yellow
$javaCmd = Get-Command java -ErrorAction SilentlyContinue
if ($javaCmd) {
    $javaVersion = java -version 2>&1 | Select-Object -First 1
    Write-Host "  ✓ Java 설치됨: $javaVersion" -ForegroundColor Green
    
    # JAVA_HOME 확인
    $javaHome = $env:JAVA_HOME
    if ($javaHome) {
        Write-Host "  ✓ JAVA_HOME: $javaHome" -ForegroundColor Green
    } else {
        Write-Host "  ⚠ JAVA_HOME 환경 변수 미설정" -ForegroundColor Yellow
    }
} else {
    Write-Host "  ✗ Java JDK 미설치" -ForegroundColor Red
    Write-Host "    다운로드: https://adoptium.net/ (JDK 17 또는 21)" -ForegroundColor Cyan
}

# 4. Android SDK 확인
Write-Host "[4] Android SDK 확인 중..." -ForegroundColor Yellow
$androidHome = $env:ANDROID_HOME
if ($androidHome -and (Test-Path $androidHome)) {
    Write-Host "  ✓ ANDROID_HOME: $androidHome" -ForegroundColor Green
} else {
    $defaultPath = "$env:LOCALAPPDATA\Android\Sdk"
    if (Test-Path $defaultPath) {
        Write-Host "  ⚠ Android SDK 발견됨: $defaultPath" -ForegroundColor Yellow
        Write-Host "    하지만 ANDROID_HOME 환경 변수가 설정되지 않았습니다." -ForegroundColor Yellow
    } else {
        Write-Host "  ✗ Android SDK 미설치" -ForegroundColor Red
        Write-Host "    다운로드: https://developer.android.com/studio" -ForegroundColor Cyan
    }
}

# 5. Expo CLI 확인
Write-Host "[5] Expo CLI 확인 중..." -ForegroundColor Yellow
$expoCmd = Get-Command expo -ErrorAction SilentlyContinue
if ($expoCmd) {
    Write-Host "  ✓ Expo CLI 설치됨" -ForegroundColor Green
} else {
    Write-Host "  ⚠ Expo CLI 미설치 (npm install로 설치 가능)" -ForegroundColor Yellow
}

# 6. EAS CLI 확인
Write-Host "[6] EAS CLI 확인 중..." -ForegroundColor Yellow
$easCmd = Get-Command eas -ErrorAction SilentlyContinue
if ($easCmd) {
    Write-Host "  ✓ EAS CLI 설치됨" -ForegroundColor Green
} else {
    Write-Host "  ⚠ EAS CLI 미설치 (npm install -g eas-cli로 설치 가능)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== 확인 완료 ===" -ForegroundColor Cyan
