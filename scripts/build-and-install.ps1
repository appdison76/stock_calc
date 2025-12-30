# 빌드 및 자동 설치 스크립트
# 사용법: .\scripts\build-and-install.ps1 [debug|release]

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("debug", "release")]
    [string]$BuildType = "debug"
)

Write-Host "`n=== 빌드 및 설치 시작 ===" -ForegroundColor Cyan
Write-Host "빌드 타입: $BuildType" -ForegroundColor Yellow

# 환경변수 설정
if (-not $env:ANDROID_HOME) {
    $env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
    Write-Host "ANDROID_HOME 설정: $env:ANDROID_HOME" -ForegroundColor Cyan
}

if (-not $env:JAVA_HOME) {
    try {
        $javaPath = (Get-Command java -ErrorAction SilentlyContinue).Source
        if ($javaPath) {
            $env:JAVA_HOME = (Split-Path (Split-Path $javaPath))
            Write-Host "JAVA_HOME 설정: $env:JAVA_HOME" -ForegroundColor Cyan
        }
    } catch {
        Write-Host "⚠️  JAVA_HOME을 자동으로 찾을 수 없습니다." -ForegroundColor Yellow
    }
}

# 프로젝트 루트로 이동
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

# 빌드 실행
Write-Host "`n[1/2] APK 빌드 중..." -ForegroundColor Green
Set-Location android

$buildResult = & .\gradlew.bat "assemble$($BuildType.Substring(0,1).ToUpper() + $BuildType.Substring(1))"

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n❌ 빌드 실패" -ForegroundColor Red
    Set-Location $projectRoot
    exit 1
}

Set-Location $projectRoot
Write-Host "✓ 빌드 완료" -ForegroundColor Green

# 설치 실행
Write-Host "`n[2/2] APK 설치 중..." -ForegroundColor Green
& "$PSScriptRoot\install-apk.ps1" -BuildType $BuildType

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n❌ 설치 실패" -ForegroundColor Red
    exit 1
}

Write-Host "`n=== 완료 ===" -ForegroundColor Cyan

