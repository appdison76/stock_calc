# 로컬 빌드 환경 구축 - 다음 단계

## ✅ 완료된 작업

1. **Java JDK 17 설치 완료**
   - 버전: OpenJDK 17.0.17
   - 설치 경로: `C:\Program Files\Eclipse Adoptium\jdk-17.0.17.10-hotspot`
   - JAVA_HOME 환경 변수 설정 완료

2. **PATH 환경 변수 업데이트 완료**
   - Java bin 경로 추가됨

## 📋 다음에 해야 할 작업

### 1. Android Studio 설치 (필수)

1. **다운로드**: https://developer.android.com/studio
2. 설치 프로그램 실행
3. 설치 시 포함 항목 확인:
   - ✅ Android SDK
   - ✅ Android SDK Platform
   - ✅ Android Virtual Device (AVD)
   - ✅ SDK Build Tools

**예상 소요 시간: 15-20분**

### 2. Android SDK 구성 요소 설치

Android Studio 설치 후:

1. **Android Studio 실행**
2. **More Actions** → **SDK Manager** 클릭
3. **SDK Platforms** 탭:
   - ✅ Android 13.0 (Tiramisu) - API Level 33
   - ✅ Android 12.0 (S) - API Level 31
4. **SDK Tools** 탭:
   - ✅ Android SDK Build-Tools
   - ✅ Android SDK Platform-Tools
   - ✅ Android SDK Command-line Tools
5. **Apply** 클릭

**예상 소요 시간: 10-15분 (인터넷 속도에 따라 다름)**

### 3. ANDROID_HOME 환경 변수 설정

Android Studio 설치 후:

```powershell
# PowerShell에서 실행 (관리자 권한 권장)
$androidSdkPath = "$env:LOCALAPPDATA\Android\Sdk"
[System.Environment]::SetEnvironmentVariable("ANDROID_HOME", $androidSdkPath, "User")

# PATH에 추가
$currentPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
$newPath = "$currentPath;$androidSdkPath\platform-tools;$androidSdkPath\tools"
[System.Environment]::SetEnvironmentVariable("Path", $newPath, "User")
```

또는 수동으로 설정:
- Windows 검색 → "환경 변수"
- **ANDROID_HOME**: `C:\Users\[사용자명]\AppData\Local\Android\Sdk`
- **Path**에 추가: `%ANDROID_HOME%\platform-tools`, `%ANDROID_HOME%\tools`

### 4. 환경 확인

PowerShell을 **새로 열고**:

```powershell
cd C:\projects\stock_calc
.\check-env-simple.ps1
```

다음이 모두 OK면 성공:
- ✅ Node.js
- ✅ npm
- ✅ Java
- ✅ JAVA_HOME
- ✅ ANDROID_HOME

### 5. 개발 빌드 재생성 (react-native-webview 포함)

환경 설정 완료 후:

```powershell
# 1. 네이티브 프로젝트 생성 (처음이면)
npx expo prebuild

# 2. 개발 빌드 빌드 및 설치
npx expo run:android
```

**예상 소요 시간: 10-30분 (처음 빌드 시)**

## 🎯 현재 상태

- ✅ Java JDK 17: 설치 완료
- ✅ JAVA_HOME: 환경 변수 설정 완료
- ⏳ Android Studio: 설치 필요
- ⏳ Android SDK: 설치 필요
- ⏳ ANDROID_HOME: Android SDK 설치 후 설정 필요

## 📝 체크리스트

- [x] Java JDK 17 설치
- [x] JAVA_HOME 환경 변수 설정
- [ ] Android Studio 설치
- [ ] Android SDK 구성 요소 설치
- [ ] ANDROID_HOME 환경 변수 설정
- [ ] 환경 확인
- [ ] 개발 빌드 재생성

## 💡 팁

- Android Studio 설치 후 **PowerShell을 새로 열어야** 환경 변수가 적용됩니다
- 첫 빌드는 시간이 오래 걸리지만, 두 번째부터는 훨씬 빠릅니다
- 빌드 중 오류가 발생하면 디스크 공간 확인 (최소 10GB 여유 공간 필요)
