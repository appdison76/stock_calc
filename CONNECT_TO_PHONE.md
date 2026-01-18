# 실제 폰으로 개발 빌드 연결하기

## 1단계: USB 디버깅 활성화 (폰)

1. **개발자 옵션 활성화**:
   - 설정 → 휴대전화 정보 → 빌드 번호를 7번 연속 탭
   
2. **USB 디버깅 활성화**:
   - 설정 → 개발자 옵션 → USB 디버깅 켜기

3. **USB로 PC 연결**:
   - USB 케이블로 폰과 PC 연결
   - "USB 디버깅 허용" 팝업에서 "허용" 선택 (기억하기 체크)

## 2단계: 기기 연결 확인

PowerShell에서:

```powershell
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
$env:ANDROID_HOME = [System.Environment]::GetEnvironmentVariable("ANDROID_HOME", "User")
& "$env:ANDROID_HOME\platform-tools\adb.exe" devices
```

출력 예시:
```
List of devices attached
ABC123XYZ    device
```

"device"가 표시되면 연결 성공!

## 3단계: 개발 빌드 설치

### 방법 1: 자동 설치 (권장)

기기가 연결된 상태에서:

```powershell
npx expo run:android
```

자동으로 폰에 설치됩니다.

### 방법 2: 수동 설치

APK 파일을 직접 설치:

```powershell
# APK 파일 위치
android\app\build\outputs\apk\debug\app-debug.apk

# 설치 명령어
& "$env:ANDROID_HOME\platform-tools\adb.exe" install android\app\build\outputs\apk\debug\app-debug.apk
```

## 4단계: 개발 서버 연결

1. **개발 서버 시작**:
   ```powershell
   npx expo start --dev-client
   ```

2. **앱에서 연결**:
   - 폰에서 앱 실행 (물타기 계산기 - Development Build)
   - "Fetch development servers" 버튼 클릭
   - 또는 QR 코드 스캔
   - 또는 `http://[PC_IP주소]:8081` 직접 입력

## WiFi로 연결하는 경우

### 같은 WiFi 네트워크 필요

1. PC와 폰이 **같은 WiFi**에 연결되어 있어야 합니다
2. 개발 서버 시작 시 표시되는 IP 주소 확인
3. 앱에서 해당 IP 주소 입력

### PC IP 주소 확인

```powershell
ipconfig | findstr IPv4
```

출력 예시:
```
IPv4 주소 . . . . . . . . . : 192.168.1.100
```

앱에서 입력: `http://192.168.1.100:8081`

## 문제 해결

### 기기가 인식되지 않을 때

1. USB 케이블 재연결
2. "USB 디버깅 허용" 팝업 다시 확인
3. USB 드라이버 설치 확인 (삼성, LG 등 제조사별)

### 연결 오류 시

```powershell
# ADB 재시작
& "$env:ANDROID_HOME\platform-tools\adb.exe" kill-server
& "$env:ANDROID_HOME\platform-tools\adb.exe" start-server
& "$env:ANDROID_HOME\platform-tools\adb.exe" devices
```

## 빠른 연결 방법

1. USB로 폰 연결 → 개발자 옵션에서 USB 디버깅 허용
2. PowerShell에서 `adb devices`로 연결 확인
3. `npx expo start --dev-client` 실행
4. 앱에서 "Fetch development servers" 클릭

완료!
