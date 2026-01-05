# 로컬 빌드용 Keystore 설정 가이드

## 현재 EAS Keystore 정보
- Key Alias: `e988e14a91952b06eded0d6b68f82f05`
- SHA1 Fingerprint: `B1:C5:32:A7:48:E2:7A:85:F2:72:1A:14:BC:E8:C1:B0:01:1E:18:3D`
- MD5 Fingerprint: `65:ED:C0:34:95:51:8C:68:75:2C:5D:D1:8D:24:A0:FC` (새로 발급받은 키)

## 기존 업로드 키 정보
- 기존 업로드 키 SHA-1: `93:E3:18:DA:10:23:24:21:BB:A4:53:0D:C0:58:67:2F`
- 이 키는 Google Play Console에 등록되어 있던 업로드 키입니다.
- 현재 EAS keystore와는 다른 키입니다.

## 방법 1: EAS Keystore 다운로드 (권장)

### 1. EAS CLI로 다운로드
```bash
eas credentials --platform android
```
- "Download existing credentials" 선택
- Keystore 다운로드
- 다운로드한 keystore 파일을 `android/app/release.keystore`로 이동

### 2. EAS 웹 대시보드에서 다운로드
1. https://expo.dev/accounts/[your-account]/projects/stock_calculator_rn/credentials 접속
2. Android credentials 섹션에서 keystore 다운로드
3. 다운로드한 파일을 `android/app/release.keystore`로 이동

### 3. gradle.properties 설정
`android/gradle.properties` 파일에 다음 내용 추가:
```properties
MYAPP_RELEASE_STORE_FILE=release.keystore
MYAPP_RELEASE_KEY_ALIAS=e988e14a91952b06eded0d6b68f82f05
MYAPP_RELEASE_STORE_PASSWORD=[EAS에서 제공한 비밀번호]
MYAPP_RELEASE_KEY_PASSWORD=[EAS에서 제공한 비밀번호]
```

## 방법 2: 기존 Keystore에서 업로드 인증서 추출

기존 keystore가 있고 업로드 키 인증서(PEM)를 추출해야 하는 경우:

### 방법 A: PowerShell 스크립트 사용 (권장)
```powershell
powershell -ExecutionPolicy Bypass -File scripts/extract-upload-certificate.ps1
```

이 스크립트는 자동으로:
- `gradle.properties`에서 비밀번호 읽기
- Keystore 정보 확인 (SHA-1, SHA-256 지문 표시)
- `android/app/upload_certificate.pem` 파일 생성

### 방법 B: 수동 추출
```bash
cd android/app
keytool -export -rfc -keystore release.keystore -alias e988e14a91952b06eded0d6b68f82f05 -file upload_certificate.pem -storepass [비밀번호]
```

비밀번호는 `gradle.properties`에 있는 `MYAPP_RELEASE_STORE_PASSWORD` 값을 사용하세요.

### 2. 인증서 정보 확인
```bash
keytool -list -v -keystore release.keystore -alias e988e14a91952b06eded0d6b68f82f05
```

### 3. Google Play Console에 업로드 키 등록
1. Google Play Console > 앱 서명 > 업로드 키 관리 접속
2. 생성된 `upload_certificate.pem` 파일 업로드
3. 또는 SHA-1/SHA-256 지문을 직접 등록

**현재 Keystore 정보:**
- SHA1: `B1:C5:32:A7:48:E2:7A:85:F2:72:1A:14:BC:E8:C1:B0:01:1E:18:3D`
- SHA256: `C4:45:1A:EB:BE:D1:E8:3E:43:8B:1E:79:5E:0A:D1:C1:EB:F0:C5:E3:40:1E:E8:92:B5:96:64:A8:9B:17:5D:12`

## 방법 3: 새 Keystore 생성 (업로드 키 재설정 후)

업로드 키 재설정이 승인되면, 새 keystore를 생성할 수 있습니다:

### 1. 새 Keystore 생성
```bash
cd android/app
keytool -genkeypair -v -storetype PKCS12 -keystore release.keystore -alias upload -keyalg RSA -keysize 2048 -validity 10000
```

### 2. Google Play Console에 업로드 키 등록
- 생성한 keystore에서 PEM 파일 추출:
```bash
keytool -export -rfc -keystore release.keystore -alias upload -file upload_certificate.pem
```
- Google Play Console > 앱 서명 > 업로드 키 관리에서 PEM 파일 업로드

### 3. gradle.properties 설정
```properties
MYAPP_RELEASE_STORE_FILE=release.keystore
MYAPP_RELEASE_KEY_ALIAS=upload
MYAPP_RELEASE_STORE_PASSWORD=[생성 시 입력한 비밀번호]
MYAPP_RELEASE_KEY_PASSWORD=[생성 시 입력한 비밀번호]
```

## 보안 주의사항

⚠️ **중요**: `gradle.properties`에 비밀번호를 직접 작성하지 마세요!

대신 환경변수나 별도 파일을 사용하세요:

### 환경변수 사용 (권장)
1. `android/gradle.properties`에서 비밀번호 제거
2. `build.gradle`에서 환경변수 읽기:
```gradle
storePassword System.getenv("MYAPP_RELEASE_STORE_PASSWORD") ?: ""
keyPassword System.getenv("MYAPP_RELEASE_KEY_PASSWORD") ?: ""
```

### 별도 파일 사용
1. `android/keystore.properties` 파일 생성 (`.gitignore`에 추가)
2. 비밀번호 정보 저장
3. `build.gradle`에서 읽기:
```gradle
def keystorePropertiesFile = rootProject.file("keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}
```

## 로컬 빌드 실행

설정 완료 후:
```bash
cd android
gradlew.bat bundleRelease
```

생성된 `.aab` 파일: `android/app/build/outputs/bundle/release/app-release.aab`



