// GitHub Pages — min-version.json 과 동일 베이스. 배포 후 앱 재배포 없이 갱신 가능.
const ISSUE_KEYWORDS_URL =
  'https://appdison76.github.io/stock_calc/issue-keywords.json';

/** 원격 JSON·앱에서 사용하는 이슈 키워드 상한 */
const ISSUE_KEYWORDS_MAX = 20;

export interface IssueKeywordItem {
  rank: number;
  keyword: string;
  count?: number;
}

interface IssueKeywordsPayload {
  keywords?: unknown;
}

/** 원격 JSON 미배포·오류 시 앱 기본 이슈 */
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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(ISSUE_KEYWORDS_URL, {
      signal: controller.signal,
      headers: {
        'Cache-Control': 'no-cache',
        Accept: 'application/json',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn('[IssueKeywords] HTTP', response.status);
      return [...FALLBACK_ISSUE_KEYWORDS];
    }

    const data = (await response.json()) as IssueKeywordsPayload;
    const parsed = parsePayload(data);
    return parsed.length > 0 ? parsed : [...FALLBACK_ISSUE_KEYWORDS];
  } catch (e) {
    console.warn('[IssueKeywords] fetch 실패:', e);
    return [...FALLBACK_ISSUE_KEYWORDS];
  }
}
