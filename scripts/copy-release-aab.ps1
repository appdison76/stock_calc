# bundleRelease 산출물을 버전·versionCode가 들어간 이름으로 같은 폴더에 복사합니다.
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$gradlePath = Join-Path $root "android\app\build.gradle"
if (-not (Test-Path $gradlePath)) {
  Write-Error "build.gradle not found: $gradlePath"
}
$gradle = Get-Content $gradlePath -Raw
if ($gradle -notmatch 'versionCode\s+(\d+)') {
  Write-Error "Could not parse versionCode from build.gradle"
}
$vc = $Matches[1]
if ($gradle -notmatch 'versionName\s+"([^"]+)"') {
  Write-Error "Could not parse versionName from build.gradle"
}
$vn = $Matches[1]

$releaseDir = Join-Path $root "android\app\build\outputs\bundle\release"
$src = Join-Path $releaseDir "app-release.aab"
$destName = "app-release-$vn-v$vc.aab"
$dest = Join-Path $releaseDir $destName

# bundleRelease가 doLast에서 app-release.aab를 버전 이름으로 rename할 수 있음
if (Test-Path $dest) {
  Write-Host "OK (already): $dest"
  exit 0
}
if (-not (Test-Path $src)) {
  Write-Error "AAB not found. Run bundleRelease first. Expected either:`n  $src`n  or $dest"
}
Copy-Item $src $dest -Force
Write-Host "OK: $dest"
