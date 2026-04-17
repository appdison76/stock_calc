import { doc, getDoc } from 'firebase/firestore';
import { getFirestoreInstance } from './FirebaseService';

/** Firestore 문서: 비로그인 읽기 전용 규칙으로 공개 */
export const ISSUE_KEYWORDS_COLLECTION = 'issueKeywords';
export const ISSUE_KEYWORDS_DOC_ID = 'current';

/** 앱에서 사용하는 이슈 키워드 상한 */
const ISSUE_KEYWORDS_MAX = 20;

export interface IssueKeywordItem {
  rank: number;
  keyword: string;
  count?: number;
}

interface IssueKeywordsPayload {
  keywords?: unknown;
}

/** Firestore 미설정·오류 시 앱 기본 이슈 */
export const FALLBACK_ISSUE_KEYWORDS: IssueKeywordItem[] = [
  { rank: 1, keyword: '이란', count: 1038 },
  { rank: 2, keyword: '트럼프', count: 218 },
  { rank: 3, keyword: '원전', count: 69 },
  { rank: 4, keyword: '스테이블코인', count: 50 },
  { rank: 5, keyword: '이스라엘', count: 43 },
  { rank: 6, keyword: '호르무즈', count: 40 },
  { rank: 7, keyword: '이재명', count: 37 },
  { rank: 8, keyword: '반도체', count: 32 },
  { rank: 9, keyword: '금리', count: 28 },
  { rank: 10, keyword: '환율', count: 25 },
];

function parsePayload(data: IssueKeywordsPayload): IssueKeywordItem[] {
  const raw = data.keywords;
  if (!Array.isArray(raw)) return [];

  const out: IssueKeywordItem[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const o = entry as Record<string, unknown>;
    const keyword = typeof o.keyword === 'string' ? o.keyword.trim() : '';
    if (!keyword) continue;
    const rank = typeof o.rank === 'number' ? o.rank : out.length + 1;
    const count = typeof o.count === 'number' ? o.count : undefined;
    out.push({ rank, keyword, count });
  }

  out.sort((a, b) => a.rank - b.rank);
  return out.slice(0, ISSUE_KEYWORDS_MAX);
}

export async function fetchIssueKeywords(): Promise<IssueKeywordItem[]> {
  try {
    const db = getFirestoreInstance();
    if (!db) {
      console.warn('[IssueKeywords] Firestore 없음');
      return [...FALLBACK_ISSUE_KEYWORDS];
    }

    const ref = doc(db, ISSUE_KEYWORDS_COLLECTION, ISSUE_KEYWORDS_DOC_ID);
    const snap = await getDoc(ref);

    if (!snap.exists) {
      console.warn('[IssueKeywords] 문서 없음:', ISSUE_KEYWORDS_COLLECTION, ISSUE_KEYWORDS_DOC_ID);
      return [...FALLBACK_ISSUE_KEYWORDS];
    }

    const data = snap.data() as IssueKeywordsPayload;
    const parsed = parsePayload(data);
    return parsed.length > 0 ? parsed : [...FALLBACK_ISSUE_KEYWORDS];
  } catch (e) {
    console.warn('[IssueKeywords] Firestore 읽기 실패:', e);
    return [...FALLBACK_ISSUE_KEYWORDS];
  }
}
