# 강제 업데이트 기능 가이드

## 📋 개요

앱 시작 시 자동으로 버전을 체크하고, 최소 필수 버전보다 낮으면 Google Play Store로 리다이렉트하는 강제 업데이트 기능입니다.

---

## 🚀 작동 방식

1. **앱 시작 시 자동 체크**: `app/_layout.tsx`에서 앱이 시작될 때 버전을 확인합니다.
2. **버전 비교**: 현재 앱 버전과 최소 필수 버전을 비교합니다.
3. **강제 업데이트 모달 표시**: 최소 버전보다 낮으면 모달이 표시되고, 앱 사용이 불가능합니다.
4. **Google Play Store로 리다이렉트**: "업데이트" 버튼을 누르면 Google Play Store로 이동합니다.

---

## ⚙️ 설정 방법

### 1. 최소 필수 버전 변경

`src/services/versionCheck.ts` 파일을 열고 `MIN_REQUIRED_VERSION` 값을 변경하세요:

```typescript
// 최소 필수 버전 (이 버전보다 낮으면 강제 업데이트)
const MIN_REQUIRED_VERSION = '1.0.0'; // 여기를 변경
```

**예시:**
- 현재 앱 버전: `1.0.1`
- 최소 필수 버전: `1.0.2`로 설정
- → `1.0.1` 사용자는 강제 업데이트 모달이 표시됩니다.

---

### 2. Google Play Store URL 확인

`src/services/versionCheck.ts`에서 패키지명을 확인하세요:

```typescript
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.neovisioning.stockcalc';
```

**실제 Google Play Store URL로 변경:**
1. Google Play Console에서 앱을 등록
2. 실제 앱 URL을 복사
3. 위의 `PLAY_STORE_URL`에 붙여넣기

---

## 📱 사용 시나리오

### 시나리오 1: 새 버전 배포 후 강제 업데이트

**1단계: 새 버전 빌드 및 배포**
```powershell
# 버전 증가
npm run version:patch

# .aab 빌드
cd android
.\gradlew.bat bundleRelease

# Google Play Store에 업로드
```

**2단계: 최소 필수 버전 업데이트**
```typescript
// src/services/versionCheck.ts
const MIN_REQUIRED_VERSION = '1.0.2'; // 새 버전으로 변경
```

**3단계: 코드 배포**
- EAS Update로 배포: `eas update --branch production`
- 또는 새 빌드 배포

**결과:**
- `1.0.1` 사용자 → 강제 업데이트 모달 표시
- `1.0.2` 이상 사용자 → 정상 사용

---

### 시나리오 2: API 서버 연동 (선택적)

나중에 서버에서 최소 버전을 관리하고 싶다면:

```typescript
// src/services/versionCheck.ts
export async function checkAppVersionAsync(): Promise<VersionInfo> {
  const minVersion = await fetchMinRequiredVersion(); // API에서 가져오기
  const currentVersion = Application.nativeApplicationVersion || '1.0.0';
  
  return {
    currentVersion,
    minRequiredVersion: minVersion,
    needsUpdate: compareVersions(currentVersion, minVersion) < 0,
  };
}
```

---

## 🔧 테스트 방법

### 테스트 1: 강제 업데이트 모달 표시

1. `src/services/versionCheck.ts`에서 `MIN_REQUIRED_VERSION`을 현재 버전보다 높게 설정:
   ```typescript
   const MIN_REQUIRED_VERSION = '2.0.0'; // 현재 버전보다 높게
   ```

2. 앱 재시작
3. 강제 업데이트 모달이 표시되는지 확인

### 테스트 2: 정상 작동 확인

1. `MIN_REQUIRED_VERSION`을 현재 버전보다 낮게 설정:
   ```typescript
   const MIN_REQUIRED_VERSION = '0.9.0'; // 현재 버전보다 낮게
   ```

2. 앱 재시작
3. 모달이 표시되지 않고 정상 작동하는지 확인

---

## 📝 파일 구조

```
src/
├── services/
│   └── versionCheck.ts          # 버전 체크 로직
└── components/
    └── ForceUpdateModal.tsx     # 강제 업데이트 모달 UI

app/
└── _layout.tsx                  # 앱 시작 시 버전 체크
```

---

## ⚠️ 주의사항

1. **최소 필수 버전은 신중하게 설정**: 너무 높게 설정하면 모든 사용자가 강제 업데이트를 받게 됩니다.
2. **Google Play Store URL 확인**: 실제 앱이 등록된 후 URL을 반드시 업데이트하세요.
3. **테스트 필수**: 배포 전에 강제 업데이트 모달이 정상 작동하는지 테스트하세요.

---

## 🎯 요약

- ✅ 앱 시작 시 자동 버전 체크
- ✅ 최소 버전보다 낮으면 강제 업데이트 모달 표시
- ✅ Google Play Store로 자동 리다이렉트
- ✅ 앱 사용 불가 (모달 닫기 불가)
- ✅ 최소 필수 버전은 코드에서 쉽게 변경 가능

**필요한 경우에만 사용하세요!** 대부분의 업데이트는 EAS Update로 충분합니다.



















