# 로컬 빌드 환경 구축 가이드

## ✅ 1단계: Java JDK 설치 (완료)

Java JDK 17이 설치되었습니다.

## 📋 2단계: Android Studio 설치

### 다운로드 및 설치
1. **다운로드**: https://developer.android.com/studio
2. 설치 프로그램 실행
3. 설치 시 다음 항목 포함 확인:
   - ✅ Android SDK
   - ✅ Android SDK Platform
   - ✅ Android Virtual Device (AVD)
   - ✅ SDK Build Tools

### Android SDK 구성 요소 설치
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
5. **Apply** 클릭하여 설치 (약 10-15분 소요)

## ⚙️ 3단계: 환경 변수 설정

### 자동 설정

PowerShell을 **관리자 권한**으로 실행 후:

```powershell
cd C:\projects\stock_calc
.\setup-env-variables.ps1
```

### 수동 설정

1. Windows 검색 → "환경 변수" 검색
2. **시스템 환경 변수 편집** 선택
3. **환경 변수** 버튼 클릭
4. **사용자 변수** 섹션에서:

   **JAVA_HOME** 추가:
   - 변수 이름: `JAVA_HOME`
   - 변수 값: `C:\Program Files\Eclipse Adoptium\jdk-17.0.17+10` (실제 설치 경로)

   **ANDROID_HOME** 추가:
   - 변수 이름: `ANDROID_HOME`
   - 변수 값: `C:\Users\[사용자명]\AppData\Local\Android\Sdk`

   **Path**에 추가 (편집):
   - `%JAVA_HOME%\bin`
   - `%ANDROID_HOME%\platform-tools`
   - `%ANDROID_HOME%\tools`

5. **확인** 클릭하여 저장
6. **PowerShell을 새로 열기** (중요!)

## ✅ 4단계: 환경 확인

새 PowerShell 창에서:

```powershell
.\check-env-simple.ps1
```

다음이 모두 OK면 성공:
- ✅ Node.js
- ✅ npm
- ✅ Java
- ✅ JAVA_HOME
- ✅ ANDROID_HOME

## 🚀 5단계: 개발 빌드 재생성

환경 설정이 완료되면:

```powershell
# 1. 네이티브 프로젝트 생성 (처음이면)
npx expo prebuild

# 2. 개발 빌드 빌드 및 설치 (react-native-webview 포함)
npx expo run:android
```

빌드는 처음 실행 시 10-30분 정도 소요됩니다.

## 📝 체크리스트

- [x] Java JDK 17 설치 완료
- [ ] Android Studio 설치
- [ ] Android SDK 구성 요소 설치 (API 33, 31, Build Tools)
- [ ] 환경 변수 설정 (JAVA_HOME, ANDROID_HOME)
- [ ] 환경 확인 (`check-env-simple.ps1`)
- [ ] 개발 빌드 재생성 (`npx expo run:android`)

## ⏱️ 예상 소요 시간

- Java JDK: ✅ 완료
- Android Studio 설치: ~15-20분
- SDK 구성 요소 다운로드: ~10-15분
- 환경 변수 설정: ~2분
- 개발 빌드: ~10-30분 (처음)

**총 예상 시간: 약 30-40분** (Android Studio 설치 후)

## 현재 상태

- ✅ Java JDK 17 설치 완료
- ⏳ Android Studio 설치 필요
- ⏳ 환경 변수 자동 설정 완료 (Android SDK 설치 후 재실행 권장)
