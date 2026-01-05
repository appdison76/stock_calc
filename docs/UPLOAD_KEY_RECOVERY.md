# 업로드 키 복구 가이드

## 현재 상황

### 키 정보 정리
1. **기존 업로드 키** (Google Play Console에 등록됨)
   - SHA-1: `93:E3:18:DA:10:23:24:21:BB:A4:53:0D:C0:58:67:2F`
   - 상태: 찾을 수 없음 (keystore 파일 분실)

2. **새로 발급받은 키** (EAS에 저장됨)
   - SHA-1: `B1:C5:32:A7:48:E2:7A:85:F2:72:1A:14:BC:E8:C1:B0:01:1E:18:3D`
   - MD5: `65:ED:C0:34:95:51:8C:68:75:2C:5D:D1:8D:24:A0:FC`
   - Key Alias: `e988e14a91952b06eded0d6b68f82f05`
   - 위치: EAS 및 `android/app/release.keystore`

## 기존 업로드 키를 찾는 방법

### 방법 1: 백업 파일 확인
다음 위치에서 keystore 백업 파일을 찾아보세요:
- 컴퓨터 백업 폴더
- 클라우드 저장소 (Google Drive, Dropbox, OneDrive 등)
- 이전 프로젝트 폴더
- USB 드라이브나 외장 하드

### 방법 2: 이전 빌드 파일에서 확인
이전에 빌드한 `.aab` 또는 `.apk` 파일이 있다면:
```bash
# AAB 파일에서 서명 정보 확인
jarsigner -verify -verbose -certs app-release.aab
```

### 방법 3: Google Play Console에서 확인
1. Google Play Console 접속
2. 앱 서명 > 업로드 키 관리로 이동
3. 등록된 업로드 키의 SHA-1 지문 확인
4. 인증서(PEM) 다운로드 가능 여부 확인

### 방법 4: EAS 빌드 히스토리 확인
EAS에서 이전에 빌드한 기록이 있다면:
```bash
eas build:list --platform android
```
이전 빌드에서 사용한 keystore 정보를 확인할 수 있습니다.

## 기존 키를 찾을 수 없는 경우

### 옵션 A: Google Play Console에서 업로드 키 재설정 요청
1. Google Play Console > 앱 서명 > 업로드 키 관리
2. "업로드 키 재설정 요청" 클릭
3. Google에서 승인하면 새 업로드 키 등록 가능
4. 승인 후 새 keystore 생성 및 등록

### 옵션 B: 새 키로 앱 재배포 (주의 필요)
⚠️ **주의**: 이 방법은 앱 서명 키가 변경되므로 기존 사용자 업데이트에 문제가 발생할 수 있습니다.

1. 새 keystore로 앱 빌드
2. Google Play Console에 새 앱으로 등록
3. 기존 앱은 단계적으로 마이그레이션

## 권장 사항

### 즉시 조치
1. **새 키 백업**: 현재 EAS keystore를 안전한 곳에 백업
2. **비밀번호 기록**: keystore 비밀번호를 안전하게 보관
3. **문서화**: 키 정보를 안전하게 문서화

### 장기 조치
1. **키 관리 시스템 사용**: 
   - Google Cloud KMS
   - AWS Secrets Manager
   - 또는 안전한 비밀번호 관리자

2. **자동 백업 설정**:
   - 정기적으로 keystore 파일 백업
   - 여러 위치에 백업 (로컬 + 클라우드)

3. **키 로테이션 계획**:
   - 정기적인 키 업데이트 계획
   - 업로드 키 재설정 프로세스 문서화

## 현재 사용 가능한 키

현재 EAS에 저장된 keystore (`android/app/release.keystore`)를 사용하여:
- 로컬 빌드 가능
- EAS 빌드 가능
- Google Play Console에 새 업로드 키로 등록 가능

새 키를 Google Play Console에 등록하려면:
```powershell
powershell -ExecutionPolicy Bypass -File scripts/extract-upload-certificate.ps1
```

생성된 `upload_certificate.pem` 파일을 Google Play Console에 업로드하세요.

