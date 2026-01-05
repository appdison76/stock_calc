# 기존 업로드 키 찾기 스크립트
# SHA-1: 93:E3:18:DA:10:23:24:21:BB:A4:53:0D:C0:58:67:2F

$ErrorActionPreference = "Stop"

$targetSha1 = "93:E3:18:DA:10:23:24:21:BB:A4:53:0D:C0:58:67:2F"
$targetSha1Normalized = $targetSha1 -replace ":", "" -replace " ", ""

Write-Host "🔍 기존 업로드 키 찾기" -ForegroundColor Cyan
Write-Host "   대상 SHA-1: $targetSha1" -ForegroundColor Gray
Write-Host ""

# 검색할 디렉토리 목록
$searchPaths = @(
    $env:USERPROFILE,
    "$env:USERPROFILE\Documents",
    "$env:USERPROFILE\Downloads",
    "$env:USERPROFILE\Desktop",
    "$env:USERPROFILE\OneDrive",
    "$env:USERPROFILE\Dropbox",
    "C:\backup",
    "D:\backup"
)

$foundKeys = @()

# keystore 파일 패턴
$keystorePatterns = @("*.keystore", "*.jks", "*.p12")

Write-Host "📂 검색 중..." -ForegroundColor Yellow

foreach ($searchPath in $searchPaths) {
    if (-not (Test-Path $searchPath)) {
        continue
    }
    
    Write-Host "   검색 중: $searchPath" -ForegroundColor Gray
    
    foreach ($pattern in $keystorePatterns) {
        try {
            $files = Get-ChildItem -Path $searchPath -Filter $pattern -Recurse -ErrorAction SilentlyContinue -Depth 3
            foreach ($file in $files) {
                Write-Host "      발견: $($file.FullName)" -ForegroundColor DarkGray
                
                # keystore 파일에서 모든 alias 확인
                try {
                    $listOutput = keytool -list -v -keystore $file.FullName -storepass "android" 2>&1
                    if ($LASTEXITCODE -eq 0) {
                        # SHA-1 지문 확인
                        $sha1Matches = $listOutput | Select-String -Pattern "SHA1:\s+([A-F0-9:]+)"
                        foreach ($match in $sha1Matches) {
                            $sha1 = $match.Matches.Groups[1].Value
                            $sha1Normalized = $sha1 -replace ":", "" -replace " ", ""
                            
                            if ($sha1Normalized -eq $targetSha1Normalized) {
                                Write-Host ""
                                Write-Host "✅ 기존 업로드 키를 찾았습니다!" -ForegroundColor Green
                                Write-Host "   파일: $($file.FullName)" -ForegroundColor White
                                Write-Host "   SHA-1: $sha1" -ForegroundColor White
                                $foundKeys += @{
                                    File = $file.FullName
                                    SHA1 = $sha1
                                }
                            }
                        }
                    }
                } catch {
                    # 비밀번호가 "android"가 아닐 수 있음, 무시
                }
            }
        } catch {
            # 접근 권한 없음 등, 무시
        }
    }
}

Write-Host ""

if ($foundKeys.Count -eq 0) {
    Write-Host "❌ 기존 업로드 키를 찾을 수 없습니다." -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 다음 방법을 시도해보세요:" -ForegroundColor Yellow
    Write-Host "   1. Google Play Console에서 업로드 키 재설정 요청" -ForegroundColor White
    Write-Host "   2. 이전 백업 파일 확인 (클라우드 저장소 등)" -ForegroundColor White
    Write-Host "   3. 이전 빌드 파일(.aab/.apk)에서 서명 정보 확인" -ForegroundColor White
    Write-Host ""
    Write-Host "📄 자세한 내용은 docs/UPLOAD_KEY_RECOVERY.md를 참고하세요." -ForegroundColor Cyan
} else {
    Write-Host "✅ 총 $($foundKeys.Count)개의 키를 찾았습니다:" -ForegroundColor Green
    foreach ($key in $foundKeys) {
        Write-Host ""
        Write-Host "   파일: $($key.File)" -ForegroundColor White
        Write-Host "   SHA-1: $($key.SHA1)" -ForegroundColor White
        Write-Host ""
        Write-Host "💡 이 keystore 파일을 안전한 곳에 백업하세요!" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "🔐 다른 비밀번호로 보호된 keystore도 확인하려면," -ForegroundColor Cyan
Write-Host "   수동으로 다음 명령어를 실행하세요:" -ForegroundColor Gray
Write-Host "   keytool -list -v -keystore [keystore파일경로]" -ForegroundColor Gray

