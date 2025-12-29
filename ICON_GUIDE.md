# 아이콘 및 스플래시 화면 가이드

## 현재 설정

앱 이름이 "주식 물타기 계산기"로 변경되었습니다.

## 아이콘 요구사항

### 1. 메인 아이콘 (`assets/icon.png`)
- **크기**: 1024x1024 픽셀 (정사각형)
- **형식**: PNG (투명 배경 가능)
- **디자인**: 파란색 우상향 화살표 (📈 스타일)
- **색상**: 파란색 (#42A5F5 또는 유사한 색상)
- **배경**: 투명 또는 단색 배경

### 2. Android Adaptive Icon (`assets/adaptive-icon.png`)
- **크기**: 1024x1024 픽셀
- **형식**: PNG
- **배경색**: #121212 (어두운 배경)
- **포어그라운드**: 파란색 우상향 화살표 아이콘
- **안전 영역**: 중앙 66% 영역에 핵심 요소 배치

### 3. 스플래시 아이콘 (`assets/splash-icon.png`)
- **크기**: 1024x1024 픽셀 (또는 더 큰 크기)
- **형식**: PNG
- **디자인**: 
  - "Neo Visioning" 로고 또는
  - 파란색 우상향 화살표
  - 또는 둘 다 포함
- **배경**: 투명 또는 #121212

### 4. Favicon (`assets/favicon.png`)
- **크기**: 48x48 픽셀 (또는 32x32)
- **형식**: PNG 또는 ICO
- **디자인**: 파란색 우상향 화살표 (간단한 버전)

## 아이콘 생성 방법

### 옵션 1: 온라인 도구 사용
1. [Figma](https://www.figma.com/) 또는 [Canva](https://www.canva.com/)에서 디자인
2. 파란색 우상향 화살표 그리기
3. 1024x1024 크기로 내보내기

### 옵션 2: 이미지 편집 도구 사용
1. Photoshop, GIMP 등에서 작업
2. 파란색 (#42A5F5) 화살표 디자인
3. 투명 배경으로 저장

### 옵션 3: SVG를 PNG로 변환
1. SVG로 아이콘 디자인
2. [CloudConvert](https://cloudconvert.com/svg-to-png) 등으로 변환
3. 1024x1024 크기로 설정

## 추천 디자인 요소

- **화살표 색상**: #42A5F5 (밝은 파란색)
- **배경**: 투명 또는 #121212 (어두운 배경)
- **스타일**: 모던하고 미니멀한 디자인
- **두께**: 화살표 선 두께는 적당히 (너무 얇지 않게)

## 파일 교체 방법

1. 위의 요구사항에 맞는 이미지를 준비
2. `assets/` 폴더에 해당 파일명으로 저장:
   - `icon.png` (1024x1024)
   - `adaptive-icon.png` (1024x1024)
   - `splash-icon.png` (1024x1024 또는 더 큰 크기)
   - `favicon.png` (48x48 또는 32x32)

3. 파일 교체 후 앱을 다시 빌드:
   ```bash
   eas build --platform android --profile development
   ```

## 현재 app.json 설정

- **아이콘 경로**: `./assets/icon.png` ✅
- **스플래시 이미지**: `./assets/splash-icon.png` ✅
- **Android Adaptive Icon**: `./assets/adaptive-icon.png` ✅

모든 경로가 올바르게 설정되어 있습니다. 이미지만 교체하면 됩니다.



