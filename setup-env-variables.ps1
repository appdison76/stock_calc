# 환경 변수 설정 스크립트 (관리자 권한 필요할 수 있음)

Write-Host "=== 환경 변수 설정 ===" -ForegroundColor Cyan
Write-Host ""

# PATH 새로고침
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# JAVA_HOME 찾기
Write-Host "[1] JAVA_HOME 찾는 중..." -ForegroundColor Yellow
$javaPath = Get-Command java -ErrorAction SilentlyContinue
if ($javaPath) {
    $javaBin = Split-Path $javaPath.Source -Parent
    $javaHome = Split-Path $javaBin -Parent
    Write-Host "  발견: $javaHome" -ForegroundColor Green
} else {
    # 일반적인 경로 확인
    $possiblePaths = @(
        "C:\Program Files\Eclipse Adoptium\jdk-17*",
        "C:\Program Files\Java\jdk-17*"
    )
    
    $javaHome = $null
    foreach ($path in $possiblePaths) {
        $found = Get-ChildItem $path -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($found -and (Test-Path "$found\bin\java.exe")) {
            $javaHome = $found.FullName
            Write-Host "  발견: $javaHome" -ForegroundColor Green
            break
        }
    }
    
    if (-not $javaHome) {
        Write-Host "  ERROR: Java 설치 경로를 찾을 수 없습니다" -ForegroundColor Red
        exit 1
    }
}

# ANDROID_HOME 확인
Write-Host ""
Write-Host "[2] Android SDK 확인 중..." -ForegroundColor Yellow
$androidSdkPath = "$env:LOCALAPPDATA\Android\Sdk"
if (Test-Path $androidSdkPath) {
    Write-Host "  발견: $androidSdkPath" -ForegroundColor Green
} else {
    Write-Host "  경고: Android SDK가 아직 설치되지 않았습니다" -ForegroundColor Yellow
    Write-Host "  Android Studio 설치 후 다시 실행하세요" -ForegroundColor Cyan
    $androidSdkPath = $null
}

# 환경 변수 설정
Write-Host ""
Write-Host "[3] 환경 변수 설정 중..." -ForegroundColor Yellow

try {
    [System.Environment]::SetEnvironmentVariable("JAVA_HOME", $javaHome, "User")
    Write-Host "  JAVA_HOME 설정 완료" -ForegroundColor Green
    
    if ($androidSdkPath) {
        [System.Environment]::SetEnvironmentVariable("ANDROID_HOME", $androidSdkPath, "User")
        Write-Host "  ANDROID_HOME 설정 완료" -ForegroundColor Green
    }
    
    # PATH 업데이트
    $currentPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
    $pathsToAdd = @(
        "$javaHome\bin"
    )
    
    if ($androidSdkPath) {
        $pathsToAdd += "$androidSdkPath\platform-tools"
        $pathsToAdd += "$androidSdkPath\tools"
    }
    
    $newPath = $currentPath
    foreach ($path in $pathsToAdd) {
        if ($newPath -notlike "*$path*") {
            $newPath = "$newPath;$path"
            Write-Host "  PATH에 추가: $path" -ForegroundColor Cyan
        }
    }
    
    [System.Environment]::SetEnvironmentVariable("Path", $newPath, "User")
    Write-Host "  PATH 업데이트 완료" -ForegroundColor Green
    
    Write-Host ""
    Write-Host "설정 완료!" -ForegroundColor Green
    Write-Host ""
    Write-Host "다음 단계:" -ForegroundColor Yellow
    Write-Host "1. PowerShell을 새로 열어 환경 변수를 새로고침하세요" -ForegroundColor Cyan
    if (-not $androidSdkPath) {
        Write-Host "2. Android Studio를 설치하세요: https://developer.android.com/studio" -ForegroundColor Cyan
    }
    
} catch {
    Write-Host "  ERROR: 환경 변수 설정 실패" -ForegroundColor Red
    Write-Host "  관리자 권한으로 실행하거나 수동으로 설정하세요" -ForegroundColor Yellow
    exit 1
}
