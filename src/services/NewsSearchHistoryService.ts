import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@news_recent_search_queries';
const MAX_ITEMS = 15;

function normalizeQuery(q: string): string {
  return q.trim();
}

export async function getRecentSearches(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
  } catch {
    return [];
  }
}

/** 검색 실행 시: 동일 문자열이 있으면 맨 위로, 최대 15개 */
export async function addRecentSearch(query: string): Promise<string[]> {
  const q = normalizeQuery(query);
  if (!q) return getRecentSearches();

  const prev = await getRecentSearches();
  const without = prev.filter((item) => item !== q);
  const next = [q, ...without].slice(0, MAX_ITEMS);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export async function removeRecentSearch(query: string): Promise<string[]> {
  const q = normalizeQuery(query);
  const prev = await getRecentSearches();
  const next = prev.filter((item) => item !== q);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
