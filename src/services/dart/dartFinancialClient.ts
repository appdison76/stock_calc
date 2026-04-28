import { DART_OPEN_API_BASE } from './dartConfig';
import type { DartFnlttRow } from './dartIncomeExtract';
import { fetchWithTimeout } from './dartHttp';
import { dartTrace } from './dartLog';

const FNLTT_TIMEOUT_MS = 45_000;

/** 정기보고서 코드 (당기 = thstrm, 천원) */
export const DART_REPRT = {
  ANNUAL: '11011',
  HALF: '11012',
  Q1: '11013',
  Q3: '11014',
} as const;

/** 단일회사 전체 재무제표 — 공식 경로는 `Acnt` (Account), `Acct` 오타 시 100번·잘못된 URL */
export async function fetchFnlttSinglAcntAll(params: {
  apiKey: string;
  corpCode: string;
  bsnsYear: number;
  reprtCode: string;
  fsDiv?: 'CFS' | 'OFS';
}): Promise<DartFnlttRow[]> {
  const { apiKey, corpCode, bsnsYear, reprtCode, fsDiv = 'CFS' } = params;
  const q = new URLSearchParams({
    crtfc_key: apiKey,
    corp_code: corpCode,
    bsns_year: String(bsnsYear),
    reprt_code: reprtCode,
    fs_div: fsDiv,
  });
  const url = `${DART_OPEN_API_BASE}/fnlttSinglAcntAll.json?${q.toString()}`;
  let res: Response;
  try {
    res = await fetchWithTimeout(url, FNLTT_TIMEOUT_MS);
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error(`DART 재무 API 시간 초과(${FNLTT_TIMEOUT_MS / 1000}초)`);
    }
    throw e;
  }
  const json = (await res.json()) as {
    status: string;
    message?: string;
    list?: DartFnlttRow | DartFnlttRow[];
  };

  if (json.status === '000') {
    if (!json.list) return [];
    return Array.isArray(json.list) ? json.list : [json.list];
  }
  /** 데이터 없음 — 미제출·해당 분기 없음 등 */
  if (json.status === '013') {
    return [];
  }
  dartTrace('fnlttSinglAcntAll_error', {
    status: json.status,
    message: json.message,
    corpCode,
    bsnsYear,
    reprtCode,
    fsDiv,
  });
  throw new Error(json.message || `DART ${json.status}`);
}
