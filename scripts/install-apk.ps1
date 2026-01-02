# APK 자동 설치 스크립트
# 사용법: .\scripts\install-apk.ps1 [debug|release]

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("debug", "release")]
    [string]$BuildType = "debug"
)

Write-Host "`nAPK 설치 중..." -ForegroundColor Green

# ADB 경로 찾기
$adbPath = $null
if ($env:ANDROID_HOME) {
    $adbPath = Join-Path $env:ANDROID_HOME "platform-tools\adb.exe"
} else {
    $defaultPath = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
    if (Test-Path $defaultPath) {
        $adbPath = $defaultPath
    }
}

if (-not $adbPath -or -not (Test-Path $adbPath)) {
    Write-Host "❌ ADB를 찾을 수 없습니다. ANDROID_HOME 환경변수를 설정하거나 ADB 경로를 확인하세요." -ForegroundColor Red
    exit 1
}

# APK 경로
$apkPath = "android\app\build\outputs\apk\$BuildType\app-$BuildType.apk"

if (-not (Test-Path $apkPath)) {
    Write-Host "❌ APK 파일을 찾을 수 없습니다: $apkPath" -ForegroundColor Red
    Write-Host "   먼저 빌드를 실행하세요: npm run build:$BuildType" -ForegroundColor Yellow
    exit 1
}

# 연결된 디바이스 확인
Write-Host "연결된 디바이스 확인 중..." -ForegroundColor Cyan
$devicesOutput = & $adbPath devices
$devices = @()

foreach ($line in $devicesOutput) {
    if ($line -match "^\s*([^\s]+)\s+device\s*$") {
        $deviceId = $matches[1]
        # 에뮬레이터 제외 (실제 디바이스만)
        if (-not $deviceId.StartsWith("emulator-")) {
            $devices += $deviceId
        }
    }
}

if ($devices.Count -eq 0) {
    Write-Host "❌ 연결된 실제 디바이스를 찾을 수 없습니다." -ForegroundColor Red
    Write-Host "   USB 디버깅이 활성화되어 있고 디바이스가 연결되어 있는지 확인하세요." -ForegroundColor Yellow
    exit 1
}

# 첫 번째 실제 디바이스에 설치
$targetDevice = $devices[0]
if ($devices.Count -gt 1) {
    Write-Host "⚠️  여러 디바이스가 연결되어 있습니다. 첫 번째 디바이스에 설치합니다: $targetDevice" -ForegroundColor Yellow
} else {
    Write-Host "✓ 디바이스 발견: $targetDevice" -ForegroundColor Green
}

Write-Host "`nAPK 설치 중: $apkPath" -ForegroundColor Cyan
Write-Host "디바이스: $targetDevice" -ForegroundColor Cyan

$installResult = & $adbPath -s $targetDevice install -r $apkPath

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✓ APK 설치 완료!" -ForegroundColor Green
    Write-Host "   디바이스에서 앱을 실행하세요." -ForegroundColor Cyan
} else {
    Write-Host "`n❌ APK 설치 실패" -ForegroundColor Red
    Write-Host $installResult
    exit 1
}



















