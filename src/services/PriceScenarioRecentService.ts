import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@price_scenario_recent_stocks_v1';

export const PRICE_SCENARIO_RECENT_MAX = 5;

export type PriceScenarioRecentEntry = {
  mockKey: string;
  officialName: string;
};

function normalizeEntries(raw: unknown): PriceScenarioRecentEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: PriceScenarioRecentEntry[] = [];
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

export async function getPriceScenarioRecent(): Promise<PriceScenarioRecentEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return normalizeEntries(JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
}

export async function pushPriceScenarioRecent(mockKey: string, label: string): Promise<PriceScenarioRecentEntry[]> {
  const mk = mockKey.trim();
  if (!mk) return getPriceScenarioRecent();
  const name = (label || '').trim() || mk;
  const prev = await getPriceScenarioRecent();
  const without = prev.filter((e) => e.mockKey !== mk);
  const next: PriceScenarioRecentEntry[] = [{ mockKey: mk, officialName: name }, ...without].slice(
    0,
    PRICE_SCENARIO_RECENT_MAX
  );
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export async function removePriceScenarioRecent(mockKey: string): Promise<PriceScenarioRecentEntry[]> {
  const mk = mockKey.trim();
  if (!mk) return getPriceScenarioRecent();
  const prev = await getPriceScenarioRecent();
  const next = prev.filter((e) => e.mockKey !== mk);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
