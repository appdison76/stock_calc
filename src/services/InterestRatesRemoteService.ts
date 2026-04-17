import { doc, getDoc } from 'firebase/firestore';
import { getFirestoreInstance } from './FirebaseService';

/** Firestore 문서: 메인 대시보드 기준금리 (비로그인 읽기 전용 규칙) */
export const INTEREST_RATES_COLLECTION = 'interestRates';
export const INTEREST_RATES_DOC_ID = 'current';

/** 원격 파싱 성공 시 (메인 화면 표시용) */
export interface InterestRatesRemoteResult {
  /** 미국: 범위 문자열 등 (예: "3.50~3.75") */
  us: string;
  kr: number;
  jp: number;
}

function parseRemotePayload(data: unknown): InterestRatesRemoteResult | null {
  if (!data || typeof data !== 'object') return null;
  const o = data as Record<string, unknown>;

  const usRaw = o.us;
  let us: string;
  if (typeof usRaw === 'string') {
    us = usRaw.trim();
  } else if (typeof usRaw === 'number' && Number.isFinite(usRaw)) {
    us = String(usRaw);
  } else {
    return null;
  }
  if (!us) return null;

  const krRaw = o.kr;
  const kr =
    typeof krRaw === 'number'
      ? krRaw
      : typeof krRaw === 'string'
        ? parseFloat(krRaw)
        : NaN;
  if (!Number.isFinite(kr)) return null;

  const jpRaw = o.jp;
  const jp =
    typeof jpRaw === 'number'
      ? jpRaw
      : typeof jpRaw === 'string'
        ? parseFloat(jpRaw)
        : NaN;
  if (!Number.isFinite(jp)) return null;

  return { us, kr, jp };
}

/**
 * Firestore interestRates/current 에서 기준금리를 가져온다.
 * 실패·형식 오류 시 null (호출측에서 기존 InterestRateService 로직으로 폴백).
 */
export async function fetchInterestRatesFromRemote(): Promise<InterestRatesRemoteResult | null> {
  try {
    const db = getFirestoreInstance();
    if (!db) {
      console.warn('[InterestRatesRemote] Firestore 없음');
      return null;
    }

    const ref = doc(db, INTEREST_RATES_COLLECTION, INTEREST_RATES_DOC_ID);
    const snap = await getDoc(ref);

    if (!snap.exists) {
      console.warn('[InterestRatesRemote] 문서 없음:', INTEREST_RATES_COLLECTION, INTEREST_RATES_DOC_ID);
      return null;
    }

    const parsed = parseRemotePayload(snap.data());
    if (!parsed) {
      console.warn('[InterestRatesRemote] 필드 형식 불일치');
      return null;
    }
    return parsed;
  } catch (e) {
    console.warn('[InterestRatesRemote] Firestore 읽기 실패:', e);
    return null;
  }
}
