# 로컬 빌드 환경 설정 스크립트
# 관리자 권한으로 실행 필요

Write-Host "로컬 빌드 환경 설정을 시작합니다..." -ForegroundColor Green

# 1. Java JDK 확인
Write-Host "`n[1/4] Java JDK 확인 중..." -ForegroundColor Yellow
$javaPath = Get-Command java -ErrorAction SilentlyContinue
if ($javaPath) {
    Write-Host "✓ Java가 설치되어 있습니다: $($javaPath.Source)" -ForegroundColor Green
    java -version
} else {
    Write-Host "✗ Java JDK가 설치되어 있지 않습니다." -ForegroundColor Red
    Write-Host "다음 링크에서 Java JDK를 다운로드하여 설치하세요:" -ForegroundColor Yellow
    Write-Host "https://adoptium.net/" -ForegroundColor Cyan
    Write-Host "설치 후 이 스크립트를 다시 실행하세요." -ForegroundColor Yellow
    exit 1
}

# 2. Android SDK 확인
Write-Host "`n[2/4] Android SDK 확인 중..." -ForegroundColor Yellow
$androidSdkPath = "$env:LOCALAPPDATA\Android\Sdk"
if (Test-Path $androidSdkPath) {
    Write-Host "✓ Android SDK가 발견되었습니다: $androidSdkPath" -ForegroundColor Green
} else {
    Write-Host "✗ Android SDK가 설치되어 있지 않습니다." -ForegroundColor Red
    Write-Host "Android Studio를 다운로드하여 설치하세요:" -ForegroundColor Yellow
    Write-Host "https://developer.android.com/studio" -ForegroundColor Cyan
    Write-Host "설치 후 이 스크립트를 다시 실행하세요." -ForegroundColor Yellow
    exit 1
}

# 3. 환경 변수 설정
Write-Host "`n[3/4] 환경 변수 설정 중..." -ForegroundColor Yellow

# JAVA_HOME 찾기
$javaHome = $null
if ($javaPath) {
    $javaBin = Split-Path $javaPath.Source -Parent
    $javaHome = Split-Path $javaBin -Parent
    if (Test-Path "$javaHome\bin\java.exe") {
        Write-Host "✓ JAVA_HOME: $javaHome" -ForegroundColor Green
    }
}

if (-not $javaHome) {
    # 일반적인 Java 설치 경로 확인
    $possibleJavaPaths = @(
        "C:\Program Files\Eclipse Adoptium\jdk-17*",
        "C:\Program Files\Eclipse Adoptium\jdk-21*",
        "C:\Program Files\Java\jdk-17*",
        "C:\Program Files\Java\jdk-21*"
    )
    
    foreach ($path in $possibleJavaPaths) {
        $found = Get-ChildItem $path -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($found -and (Test-Path "$found\bin\java.exe")) {
            $javaHome = $found.FullName
            Write-Host "✓ JAVA_HOME 발견: $javaHome" -ForegroundColor Green
            break
        }
    }
}

if (-not $javaHome) {
    Write-Host "✗ JAVA_HOME을 자동으로 찾을 수 없습니다." -ForegroundColor Red
    Write-Host "수동으로 JAVA_HOME을 설정하세요." -ForegroundColor Yellow
    exit 1
}

# 환경 변수 설정
try {
    [System.Environment]::SetEnvironmentVariable("JAVA_HOME", $javaHome, "User")
    [System.Environment]::SetEnvironmentVariable("ANDROID_HOME", $androidSdkPath, "User")
    
    # PATH 업데이트
    $currentPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
    $pathsToAdd = @(
        "$javaHome\bin",
        "$androidSdkPath\platform-tools",
        "$androidSdkPath\tools"
    )
    
    $newPath = $currentPath
    foreach ($path in $pathsToAdd) {
        if ($newPath -notlike "*$path*") {
            $newPath = "$newPath;$path"
        }
    }
    
    [System.Environment]::SetEnvironmentVariable("Path", $newPath, "User")
    
    Write-Host "✓ 환경 변수가 설정되었습니다." -ForegroundColor Green
    Write-Host "  JAVA_HOME: $javaHome" -ForegroundColor Cyan
    Write-Host "  ANDROID_HOME: $androidSdkPath" -ForegroundColor Cyan
} catch {
    Write-Host "✗ 환경 변수 설정 실패: $_" -ForegroundColor Red
    Write-Host "관리자 권한으로 실행하세요." -ForegroundColor Yellow
    exit 1
}

# 4. Gradle 설정 확인
Write-Host "`n[4/4] Gradle 설정 확인 중..." -ForegroundColor Yellow
$gradlePropsPath = ".\android\gradle.properties"
if (-not (Test-Path $gradlePropsPath)) {
    Write-Host "Gradle 설정 파일을 생성합니다..." -ForegroundColor Yellow
    $gradlePropsContent = @"
org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
android.useAndroidX=true
android.enableJetifier=true
"@
    New-Item -Path ".\android" -ItemType Directory -Force | Out-Null
    Set-Content -Path $gradlePropsPath -Value $gradlePropsContent
    Write-Host "✓ Gradle 설정 파일 생성 완료" -ForegroundColor Green
} else {
    Write-Host "✓ Gradle 설정 파일이 이미 존재합니다" -ForegroundColor Green
}

Write-Host "`n✓ 로컬 빌드 환경 설정이 완료되었습니다!" -ForegroundColor Green
Write-Host "`n다음 단계:" -ForegroundColor Yellow
Write-Host "1. PowerShell을 새로 열어 환경 변수를 새로고침하세요" -ForegroundColor Cyan
Write-Host "2. 다음 명령어로 빌드를 실행하세요:" -ForegroundColor Cyan
Write-Host "   cd stock_calculator_rn" -ForegroundColor White
Write-Host "   eas build --platform android --profile preview --local" -ForegroundColor White



