# Stock Calculator (React Native)

Flutter로 작성된 주식 계산기 앱을 React Native (Expo)로 변환한 프로젝트입니다.

## 주요 기능

- **수익률 계산기**: 매수가, 매도가, 수량을 입력하여 수익률과 순수익을 계산합니다.
- **물타기 계산기**: 현재 보유 주식과 추가 매수 정보를 합산하여 새로운 평균 단가를 계산합니다.
- **환경설정**: 원화/달러별 거래세와 수수료를 설정할 수 있습니다.
- **통화 지원**: 원화(KRW)와 달러(USD)를 지원하며, 실시간 환율을 가져옵니다.
- **결과 공유**: 계산 결과를 텍스트 또는 이미지로 공유할 수 있습니다.
- **쿠팡 배너**: 쿠팡 파트너스 상품을 표시합니다.

## 기술 스택

- **Framework**: Expo SDK 54
- **Navigation**: Expo Router (app 폴더 기반 구조)
- **Language**: TypeScript
- **Styling**: React Native StyleSheet (다크 모드, 모던한 카드 UI)

## 설치 및 실행

```bash
# 의존성 설치
npm install

# 개발 서버 시작
npm start

# Android 실행
npm run android

# iOS 실행
npm run ios

# Web 실행
npm run web
```

## 프로젝트 구조

```
stock_calculator_rn/
├── app/                    # Expo Router 화면
│   ├── _layout.tsx        # 레이아웃 설정
│   ├── index.tsx          # 메인 화면
│   ├── profit.tsx         # 수익률 계산기
│   ├── averaging.tsx      # 물타기 계산기
│   └── settings.tsx       # 환경설정
├── src/
│   ├── models/            # 데이터 모델
│   ├── services/          # 서비스 (API, 설정 등)
│   ├── components/        # 공통 컴포넌트
│   └── utils/             # 유틸리티 함수
└── assets/                # 이미지 및 리소스
```

## 주요 파일

- `src/models/`: ProfitCalculation, AveragingCalculation, Currency, ProductItem
- `src/services/`: SettingsService, ExchangeRateService, CoupangApiService
- `src/components/`: CurrencySwitch, CalculationResultCard, SharedResultSection, CoupangBannerSection

## 라이선스

이 프로젝트는 개인 프로젝트입니다.



