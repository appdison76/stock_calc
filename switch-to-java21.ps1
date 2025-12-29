# Java 21로 JAVA_HOME과 PATH 변경 스크립트
# 관리자 권한으로 실행 필요

Write-Host "Java 21로 환경 변수 변경을 시작합니다..." -ForegroundColor Green

# Java 21 찾기
Write-Host "`n[1/3] Java 21 설치 경로 찾는 중..." -ForegroundColor Yellow
$java21Path = $null

$possibleJava21Paths = @(
    "C:\Program Files\Eclipse Adoptium\jdk-21*",
    "C:\Program Files (x86)\Eclipse Adoptium\jdk-21*",
    "C:\Program Files\Java\jdk-21*"
)

foreach ($path in $possibleJava21Paths) {
    $found = Get-ChildItem $path -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($found -and (Test-Path "$($found.FullName)\bin\java.exe")) {
        $java21Path = $found.FullName
        Write-Host "✓ Java 21 발견: $java21Path" -ForegroundColor Green
        break
    }
}

if (-not $java21Path) {
    Write-Host "✗ Java 21을 찾을 수 없습니다." -ForegroundColor Red
    Write-Host "`nJava 21을 먼저 설치하세요:" -ForegroundColor Yellow
    Write-Host "https://adoptium.net/temurin/releases/?version=21" -ForegroundColor Cyan
    Write-Host "Windows x64용 JDK 21 LTS를 다운로드하여 설치하세요." -ForegroundColor Yellow
    exit 1
}

# 현재 JAVA_HOME 확인
Write-Host "`n[2/3] 현재 JAVA_HOME 확인 중..." -ForegroundColor Yellow
$currentJavaHome = [System.Environment]::GetEnvironmentVariable("JAVA_HOME", "User")
if ($currentJavaHome) {
    Write-Host "현재 JAVA_HOME: $currentJavaHome" -ForegroundColor Cyan
} else {
    Write-Host "JAVA_HOME이 설정되어 있지 않습니다." -ForegroundColor Yellow
}

# 환경 변수 변경
Write-Host "`n[3/3] 환경 변수 변경 중..." -ForegroundColor Yellow
try {
    # JAVA_HOME 변경
    [System.Environment]::SetEnvironmentVariable("JAVA_HOME", $java21Path, "User")
    Write-Host "✓ JAVA_HOME이 변경되었습니다: $java21Path" -ForegroundColor Green
    
    # PATH 업데이트
    $currentPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
    $java21Bin = "$java21Path\bin"
    
    # 기존 Java 경로 제거 (jdk-25, jdk-17 등)
    $pathArray = $currentPath -split ';' | Where-Object { 
        $_ -and 
        $_ -notlike "*jdk-25*" -and 
        $_ -notlike "*jdk-17*" -and
        $_ -notlike "*jdk-19*" -and
        $_ -notlike "*jdk-20*" -and
        $_ -notlike "*jdk-22*" -and
        $_ -notlike "*jdk-23*" -and
        $_ -notlike "*jdk-24*"
    }
    
    # Java 21 bin 경로 추가 (이미 있으면 추가하지 않음)
    if ($pathArray -notcontains $java21Bin) {
        $pathArray = @($java21Bin) + $pathArray
    }
    
    $newPath = $pathArray -join ';'
    [System.Environment]::SetEnvironmentVariable("Path", $newPath, "User")
    Write-Host "✓ PATH가 업데이트되었습니다." -ForegroundColor Green
    
    Write-Host "`n✓ 환경 변수 변경이 완료되었습니다!" -ForegroundColor Green
    Write-Host "`n중요: PowerShell을 새로 열어야 변경사항이 적용됩니다." -ForegroundColor Yellow
    Write-Host "`n새 PowerShell에서 다음 명령어로 확인하세요:" -ForegroundColor Cyan
    Write-Host "  java -version" -ForegroundColor White
    Write-Host "  `$env:JAVA_HOME" -ForegroundColor White
    Write-Host "`nJava 21이 표시되어야 합니다." -ForegroundColor Cyan
    
} catch {
    Write-Host "✗ 환경 변수 변경 실패: $_" -ForegroundColor Red
    Write-Host "관리자 권한으로 실행하세요." -ForegroundColor Yellow
    exit 1
}


