# 로컬 빌드 환경 설정 가이드

## 필수 요구사항

### 1. Java JDK 설치
- **다운로드**: https://adoptium.net/ (OpenJDK 17 또는 21 권장)
- **설치 후 확인**: `java -version`

### 2. Android Studio 설치
- **다운로드**: https://developer.android.com/studio
- **설치 시 포함 항목**:
  - Android SDK
  - Android SDK Platform
  - Android Virtual Device (AVD)
  - SDK Build Tools

### 3. 환경 변수 설정

#### Windows PowerShell에서 설정:
```powershell
# JAVA_HOME 설정 (JDK 설치 경로로 변경)
[System.Environment]::SetEnvironmentVariable("JAVA_HOME", "C:\Program Files\Java\jdk-17", "User")

# ANDROID_HOME 설정 (Android SDK 경로로 변경)
[System.Environment]::SetEnvironmentVariable("ANDROID_HOME", "$env:LOCALAPPDATA\Android\Sdk", "User")

# PATH에 추가
$currentPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
$newPath = "$currentPath;$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\tools"
[System.Environment]::SetEnvironmentVariable("Path", $newPath, "User")
```

#### 수동 설정 방법:
1. Windows 검색에서 "환경 변수" 검색
2. "시스템 환경 변수 편집" 선택
3. "환경 변수" 버튼 클릭
4. 다음 변수 추가/수정:
   - `JAVA_HOME`: `C:\Program Files\Java\jdk-17` (실제 설치 경로)
   - `ANDROID_HOME`: `C:\Users\[사용자명]\AppData\Local\Android\Sdk` (실제 SDK 경로)
   - `Path`에 추가:
     - `%JAVA_HOME%\bin`
     - `%ANDROID_HOME%\platform-tools`
     - `%ANDROID_HOME%\tools`

### 4. Android SDK 구성 요소 설치

Android Studio에서:
1. **Tools** → **SDK Manager** 열기
2. **SDK Platforms** 탭:
   - Android 13.0 (Tiramisu) - API Level 33
   - Android 12.0 (S) - API Level 31
3. **SDK Tools** 탭:
   - Android SDK Build-Tools
   - Android SDK Platform-Tools
   - Android SDK Command-line Tools

### 5. Gradle 설정 확인

프로젝트 루트에 `gradle.properties` 파일이 없으면 생성:
```properties
org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
android.useAndroidX=true
android.enableJetifier=true
```

## 로컬 빌드 실행

환경 설정 완료 후:

```bash
cd stock_calculator_rn
eas build --platform android --profile preview --local
```

## 문제 해결

### Java 버전 확인
```bash
java -version
```

### Android SDK 경로 확인
```bash
echo $env:ANDROID_HOME  # PowerShell
echo $ANDROID_HOME      # CMD
```

### Gradle 버전 확인
```bash
cd android
./gradlew --version
```

## 참고사항

- 로컬 빌드는 시간이 오래 걸릴 수 있습니다 (10-30분)
- 첫 빌드 시 많은 의존성을 다운로드합니다
- 디스크 공간이 충분한지 확인하세요 (최소 10GB 여유 공간 권장)



