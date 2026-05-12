import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@cap_per_por_recent_stocks_v1';

/** 시총계산기에 저장·표시되는 최근 종목 개수 상한 */
export const CAP_PER_POR_RECENT_MAX = 5;

export type CapPerPorRecentEntry = {
  mockKey: string;
  officialName: string;
};

function normalizeEntries(raw: unknown): CapPerPorRecentEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: CapPerPorRecentEntry[] = [];
  for (const item of raw) {
    if (item == null || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const mk = typeof o.mockKey === 'string' ? o.mockKey.trim() : '';
    const name = typeof o.officialName === 'string' ? o.officialName.trim() : '';
    if (!mk) continue;
    out.push({ mockKey: mk, officialName: name || mk });
  }
  return out;
}

export async function getCapPerPorRecent(): Promise<CapPerPorRecentEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return normalizeEntries(JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
}

/** 동일 mockKey면 맨 앞으로, 최대 `CAP_PER_POR_RECENT_MAX`개 */
export async function pushCapPerPorRecent(mockKey: string, label: string): Promise<CapPerPorRecentEntry[]> {
  const mk = mockKey.trim();
  if (!mk) return getCapPerPorRecent();
  const name = (label || '').trim() || mk;
  const prev = await getCapPerPorRecent();
  const without = prev.filter((e) => e.mockKey !== mk);
  const next: CapPerPorRecentEntry[] = [{ mockKey: mk, officialName: name }, ...without].slice(0, CAP_PER_POR_RECENT_MAX);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

/** 최근 목록에서 한 종목 제거 */
export async function removeCapPerPorRecent(mockKey: string): Promise<CapPerPorRecentEntry[]> {
  const mk = mockKey.trim();
  if (!mk) return getCapPerPorRecent();
  const prev = await getCapPerPorRecent();
  const next = prev.filter((e) => e.mockKey !== mk);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
