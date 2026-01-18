# 새 노트북 개발 환경 설정 가이드

## 현재 상태
- ❌ Node.js: 미설치
- ❌ npm: 미설치  
- ❌ Java JDK: 미설치
- ❌ Android SDK: 미설치

## 📋 설치 순서

### 1단계: Node.js 설치 (최우선)

1. **다운로드**: https://nodejs.org/
   - **LTS 버전** 다운로드 (권장: v20.x 또는 v22.x)
   - Windows Installer (.msi) 선택

2. **설치**:
   - 다운로드한 파일 실행
   - 기본 설정으로 설치 진행 (모두 체크)
   - 설치 완료 후 **PowerShell을 새로 열기**

3. **확인**:
   ```powershell
   node --version
   npm --version
   ```
   둘 다 버전이 표시되면 성공!

4. **npm 패키지 설치**:
   ```powershell
   cd C:\projects\stock_calc
   npm install
   ```
   이 명령어로 `react-native-webview`를 포함한 모든 패키지가 설치됩니다.

---

### 2단계: Java JDK 설치 (로컬 빌드용)

1. **다운로드**: https://adoptium.net/
   - **Windows x64** 선택
   - **JDK 17** 또는 **JDK 21** (LTS 버전)
   - **Installer** 다운로드

2. **설치**:
   - 다운로드한 파일 실행
   - 설치 경로 확인 (예: `C:\Program Files\Eclipse Adoptium\jdk-17.0.x`)

3. **확인**:
   ```powershell
   java -version
   ```

---

### 3단계: Android Studio 설치 (로컬 빌드용)

1. **다운로드**: https://developer.android.com/studio

2. **설치**:
   - 설치 프로그램 실행
   - 설치 시 다음 항목 포함 확인:
     - ✅ Android SDK
     - ✅ Android SDK Platform
     - ✅ Android Virtual Device (AVD)
     - ✅ SDK Build Tools

3. **Android Studio 실행 후**:
   - **More Actions** → **SDK Manager**
   - **SDK Platforms** 탭에서:
     - ✅ Android 13.0 (Tiramisu) - API Level 33
     - ✅ Android 12.0 (S) - API Level 31
   - **SDK Tools** 탭에서:
     - ✅ Android SDK Build-Tools
     - ✅ Android SDK Platform-Tools
     - ✅ Android SDK Command-line Tools
   - **Apply** 클릭하여 설치

---

### 4단계: 환경 변수 설정

#### 자동 설정 (권장)

PowerShell을 **관리자 권한**으로 실행:
```powershell
cd C:\projects\stock_calc
.\setup-local-build.ps1
```

#### 수동 설정

1. Windows 검색 → "환경 변수" 검색
2. **시스템 환경 변수 편집** 선택
3. **환경 변수** 버튼 클릭
4. **사용자 변수** 섹션에서:

   **JAVA_HOME** 추가:
   - 변수 이름: `JAVA_HOME`
   - 변수 값: `C:\Program Files\Eclipse Adoptium\jdk-17` (실제 설치 경로)

   **ANDROID_HOME** 추가:
   - 변수 이름: `ANDROID_HOME`
   - 변수 값: `C:\Users\[사용자명]\AppData\Local\Android\Sdk`

   **Path**에 추가 (편집):
   - `%JAVA_HOME%\bin`
   - `%ANDROID_HOME%\platform-tools`
   - `%ANDROID_HOME%\tools`

5. **확인**을 클릭하여 저장
6. **PowerShell을 새로 열기** (환경 변수 새로고침)

---

## 🚀 빠른 시작 (개발 모드)

### Node.js 설치 후 바로 시작:

```powershell
# 1. 프로젝트 폴더로 이동
cd C:\projects\stock_calc

# 2. 패키지 설치
npm install

# 3. 개발 서버 시작
npm start
```

Expo Go 앱으로 QR 코드 스캔하면 바로 테스트 가능합니다!

---

## 📦 필수 패키지 설치 확인

Node.js 설치 후 다음 명령어로 확인:

```powershell
# 현재 환경 확인
.\check-env-simple.ps1

# 필요한 전역 패키지 설치 (선택사항)
npm install -g eas-cli
npm install -g @expo/cli
```

---

## ⚠️ 문제 해결

### npm install이 안 될 때
- PowerShell을 새로 열어보세요
- 관리자 권한으로 실행해보세요
- 인터넷 연결 확인

### 패키지 설치 중 오류
```powershell
# 캐시 정리 후 재시도
npm cache clean --force
npm install
```

### 환경 변수가 적용 안 될 때
- PowerShell을 완전히 닫고 새로 열기
- 또는 컴퓨터 재시작

---

## ✅ 설치 완료 체크리스트

- [ ] Node.js 설치 및 확인 (`node --version`)
- [ ] npm 설치 및 확인 (`npm --version`)
- [ ] 프로젝트 패키지 설치 (`npm install`)
- [ ] Java JDK 설치 및 확인 (`java -version`) - 로컬 빌드용
- [ ] Android Studio 설치 - 로컬 빌드용
- [ ] 환경 변수 설정 (JAVA_HOME, ANDROID_HOME) - 로컬 빌드용

---

## 🎯 지금 바로 해야 할 것

1. **Node.js 설치** (가장 중요!)
   - https://nodejs.org/ 에서 LTS 버전 다운로드
   - 설치 후 PowerShell 새로 열기

2. **npm install 실행**
   ```powershell
   cd C:\projects\stock_calc
   npm install
   ```

3. **개발 서버 시작**
   ```powershell
   npm start
   ```

로컬 빌드는 나중에 해도 됩니다. 우선 개발 모드로 앱을 실행하는 것이 중요합니다!
