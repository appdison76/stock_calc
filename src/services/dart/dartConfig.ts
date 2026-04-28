import Constants from 'expo-constants';

export const DART_OPEN_API_BASE = 'https://opendart.fss.or.kr/api';

export function getDartApiKey(): string {
  const k = Constants.expoConfig?.extra?.dartApiKey;
  return typeof k === 'string' && k.trim() ? k.trim() : '';
}

export const DART_FUNDAMENTALS_DISCLOSURE =
  '국내 6자리 종목: 금융위 전자공시(DART) 연결재무제표(CFS) 기준. 금액 단위는 공시 천원을 원화로 환산해 표시합니다. 시가총액·PER은 추후 연동 예정입니다.';
