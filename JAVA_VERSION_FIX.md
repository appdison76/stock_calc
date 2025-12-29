# Java 버전 문제 해결

현재 Java 25가 설치되어 있지만, Gradle 8.14.3은 Java 21까지만 지원합니다.

## 해결 방법

### 옵션 1: Java 21 LTS 설치 (권장)

1. **Java 21 다운로드 및 설치**
   - https://adoptium.net/temurin/releases/?version=21
   - Windows x64용 JDK 21 LTS 다운로드 및 설치

2. **JAVA_HOME 변경**
   - Windows 검색에서 "환경 변수" 검색
   - "시스템 환경 변수 편집" 선택
   - "환경 변수" 버튼 클릭
   - 사용자 변수에서 `JAVA_HOME` 선택 후 "편집"
   - 값을 Java 21 설치 경로로 변경 (예: `C:\Program Files\Eclipse Adoptium\jdk-21.x.x-hotspot`)
   - "확인" 클릭

3. **PowerShell 재시작**
   - 현재 PowerShell 창을 닫고 새로 열기

4. **확인**
   ```powershell
   java -version
   # Java 21이 표시되어야 합니다
   ```

### 옵션 2: Gradle 버전 업그레이드 (고급)

Gradle을 최신 버전으로 업그레이드하면 Java 25를 지원할 수 있지만, Expo 호환성 문제가 발생할 수 있습니다.

---

**Java 21 설치 후 알려주시면 빌드를 계속 진행하겠습니다.**


