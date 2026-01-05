# 로컬 빌드용 Keystore 설정 가이드

## 현재 EAS Keystore 정보
- Key Alias: `e988e14a91952b06eded0d6b68f82f05`
- SHA1 Fingerprint: `B1:C5:32:A7:48:E2:7A:85:F2:72:1A:14:BC:E8:C1:B0:01:1E:18:3D`

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

## 방법 2: 새 Keystore 생성 (업로드 키 재설정 후)

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

