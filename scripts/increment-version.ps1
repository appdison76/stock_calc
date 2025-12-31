# 버전 자동 증가 스크립트
# 사용법: .\scripts\increment-version.ps1 [patch|minor|major]

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("patch", "minor", "major")]
    [string]$Type = "patch"
)

Write-Host "버전 증가 중..." -ForegroundColor Green

# app.json 읽기
$appJsonPath = "app.json"
$appJson = Get-Content $appJsonPath | ConvertFrom-Json

# 현재 버전 파싱
$currentVersion = $appJson.expo.version
$versionParts = $currentVersion -split '\.'
$major = [int]$versionParts[0]
$minor = [int]$versionParts[1]
$patch = [int]$versionParts[2]

# 버전 증가
switch ($Type) {
    "major" {
        $major++
        $minor = 0
        $patch = 0
    }
    "minor" {
        $minor++
        $patch = 0
    }
    "patch" {
        $patch++
    }
}

$newVersion = "$major.$minor.$patch"
Write-Host "현재 버전: $currentVersion" -ForegroundColor Yellow
Write-Host "새 버전: $newVersion" -ForegroundColor Green

# app.json 업데이트
$appJson.expo.version = $newVersion
$appJson | ConvertTo-Json -Depth 10 | Set-Content $appJsonPath -Encoding UTF8

# build.gradle 읽기 및 업데이트
$buildGradlePath = "android\app\build.gradle"
$buildGradleContent = Get-Content $buildGradlePath -Raw

# versionCode 증가 (현재 값 찾기)
$versionCodePattern = 'versionCode\s+(\d+)'
if ($buildGradleContent -match $versionCodePattern) {
    $currentVersionCode = [int]$matches[1]
    $newVersionCode = $currentVersionCode + 1
    Write-Host "versionCode: $currentVersionCode -> $newVersionCode" -ForegroundColor Cyan
    
    $buildGradleContent = $buildGradleContent -replace $versionCodePattern, "versionCode $newVersionCode"
} else {
    Write-Host "versionCode를 찾을 수 없습니다" -ForegroundColor Red
}

# versionName 업데이트
$versionNamePattern = 'versionName\s+"([^"]+)"'
$buildGradleContent = $buildGradleContent -replace $versionNamePattern, "versionName `"$newVersion`""

Set-Content $buildGradlePath -Value $buildGradleContent -Encoding UTF8

Write-Host "`n✓ 버전 업데이트 완료!" -ForegroundColor Green
Write-Host "  app.json: $newVersion" -ForegroundColor Cyan
Write-Host "  build.gradle: versionCode $newVersionCode, versionName $newVersion" -ForegroundColor Cyan













