# 빠른 로컬 빌드 설정 가이드

## 현재 상태
- ✅ Node.js: 설치됨 (v24.12.0)
- ❌ Java JDK: 설치 필요
- ❌ Android SDK: 설치 필요

## 1단계: Java JDK 설치 (필수)

### 다운로드 및 설치
1. https://adoptium.net/ 접속
2. **Windows x64** 선택
3. **JDK 17** 또는 **JDK 21** 선택 (LTS 버전 권장)
4. 다운로드 후 설치 실행
5. 설치 경로 확인 (예: `C:\Program Files\Eclipse Adoptium\jdk-17.0.x`)

### 설치 확인
PowerShell에서:
```powershell
java -version
```

## 2단계: Android Studio 설치 (필수)

### 다운로드 및 설치
1. https://developer.android.com/studio 접속
2. **Download Android Studio** 클릭
3. 설치 프로그램 실행
4. 설치 시 **Android SDK**, **Android SDK Platform**, **Android Virtual Device** 포함 확인

### Android SDK 구성 요소 설치
1. Android Studio 실행
2. **More Actions** → **SDK Manager** 클릭
3. **SDK Platforms** 탭:
   - ✅ Android 13.0 (Tiramisu) - API Level 33
   - ✅ Android 12.0 (S) - API Level 31
4. **SDK Tools** 탭:
   - ✅ Android SDK Build-Tools
   - ✅ Android SDK Platform-Tools
   - ✅ Android SDK Command-line Tools
5. **Apply** 클릭하여 설치

## 3단계: 환경 변수 설정

### 자동 설정 (권장)
PowerShell을 **관리자 권한**으로 실행 후:
```powershell
cd C:\Users\minch\Desktop\stock_calculator3\stock_calculator_rn
.\setup-local-build.ps1
```

### 수동 설정
1. Windows 검색에서 "환경 변수" 검색
2. **시스템 환경 변수 편집** 선택
3. **환경 변수** 버튼 클릭
4. **사용자 변수** 섹션에서:
   - `JAVA_HOME` 추가: `C:\Program Files\Eclipse Adoptium\jdk-17` (실제 경로)
   - `ANDROID_HOME` 추가: `C:\Users\minch\AppData\Local\Android\Sdk`
   - `Path`에 추가:
     - `%JAVA_HOME%\bin`
     - `%ANDROID_HOME%\platform-tools`
     - `%ANDROID_HOME%\tools`

## 4단계: 환경 확인

새 PowerShell 창에서:
```powershell
cd C:\Users\minch\Desktop\stock_calculator3\stock_calculator_rn
java -version
echo $env:JAVA_HOME
echo $env:ANDROID_HOME
```

모두 정상이면 다음 단계로 진행!

## 5단계: 로컬 빌드 실행

```powershell
cd C:\Users\minch\Desktop\stock_calculator3\stock_calculator_rn
eas build --platform android --profile preview --local
```

## 예상 소요 시간
- Java JDK 설치: 5분
- Android Studio 설치: 15-20분
- SDK 구성 요소 다운로드: 10-15분
- 환경 변수 설정: 2분
- **총 예상 시간: 약 30-40분**

## 문제 해결

### Java가 인식되지 않는 경우
- PowerShell을 새로 열어보세요 (환경 변수 새로고침)
- 설치 경로가 올바른지 확인하세요

### Android SDK를 찾을 수 없는 경우
- Android Studio에서 SDK Manager를 열어 경로를 확인하세요
- 일반 경로: `C:\Users\[사용자명]\AppData\Local\Android\Sdk`

### 빌드 중 오류 발생 시
- 디스크 공간 확인 (최소 10GB 여유 공간 필요)
- 인터넷 연결 확인 (의존성 다운로드 필요)



