import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MyShortcut } from '../models/MyShortcut';

const STORAGE_KEY = '@my_shortcuts_v1';
/** 기존 사용자에게 샘플 영상 1회만 주입했는지 (삭제 후 재등장 방지) */
const KEY_CHART_SAMPLE_MIGRATION_DONE = '@my_shortcuts_chart_sample_migration_v1';

export const DEFAULT_FEAR_GREED_ID = 'default-fear-greed';
/** 삭제 가능한 앱 제공 샘플(유튜브) */
export const SAMPLE_CHART_VIDEO_ID = 'sample-chart-how-to-youtube';

const DEFAULT_FEAR_GREED: MyShortcut = {
  id: DEFAULT_FEAR_GREED_ID,
  title: '공포지수',
  url: 'https://edition.cnn.com/markets/fear-and-greed',
  iconEmoji: '📊',
  showOnMain: true,
  sortOrder: 0,
  isDefault: true,
};

const DEFAULT_SAMPLE_CHART_VIDEO: MyShortcut = {
  id: SAMPLE_CHART_VIDEO_ID,
  title: '차트보는법',
  url: 'https://www.youtube.com/watch?si=HYKgmBwHUTgs8vwl&v=aHQ_vNytpOU&feature=youtu.be',
  iconEmoji: '📺',
  showOnMain: true,
  sortOrder: 1,
  isDefault: false,
};

function isYoutubeUrl(url: string): boolean {
  const u = url.trim().toLowerCase();
  return (
    u.includes('youtube.com') ||
    u.includes('youtu.be') ||
    u.includes('m.youtube.com')
  );
}

/** URL 기준 기본 이모지: 유튜브 📺, 그 외 🔗 */
export function suggestedEmojiForUrl(url: string): string {
  if (!url.trim()) return '🔗';
  return isYoutubeUrl(url) ? '📺' : '🔗';
}

export function deriveTitleFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '바로가기';
  }
}

function normalizeUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

function ensureDefaults(list: MyShortcut[]): MyShortcut[] {
  const has = list.some((s) => s.id === DEFAULT_FEAR_GREED_ID);
  if (!has) {
    const bumped = list.map((s) => ({ ...s, sortOrder: s.sortOrder + 1 }));
    return [{ ...DEFAULT_FEAR_GREED, sortOrder: 0 }, ...bumped];
  }
  return list.map((s) => ({ ...s }));
}

function sortByOrder(list: MyShortcut[]): MyShortcut[] {
  return list.slice().sort((a, b) => a.sortOrder - b.sortOrder);
}

async function persistInitialDefaults(): Promise<MyShortcut[]> {
  const initial = [
    { ...DEFAULT_FEAR_GREED, sortOrder: 0 },
    { ...DEFAULT_SAMPLE_CHART_VIDEO, sortOrder: 1 },
  ];
  await saveMyShortcuts(initial);
  await AsyncStorage.setItem(KEY_CHART_SAMPLE_MIGRATION_DONE, '1');
  return sortByOrder(ensureDefaults(JSON.parse((await AsyncStorage.getItem(STORAGE_KEY)) || '[]')));
}

/** 예전에 공포지수만 있던 데이터에 유튜브 샘플 1회 추가 */
async function appendChartSampleIfLegacyUser(list: MyShortcut[]): Promise<MyShortcut[]> {
  try {
    const done = await AsyncStorage.getItem(KEY_CHART_SAMPLE_MIGRATION_DONE);
    if (done === '1') return list;
    if (list.some((s) => s.id === SAMPLE_CHART_VIDEO_ID)) {
      await AsyncStorage.setItem(KEY_CHART_SAMPLE_MIGRATION_DONE, '1');
      return list;
    }
    const sorted = sortByOrder(list);
    const maxOrder = sorted.length ? Math.max(...sorted.map((s) => s.sortOrder)) : -1;
    const withSample = [...sorted, { ...DEFAULT_SAMPLE_CHART_VIDEO, sortOrder: maxOrder + 1 }];
    await saveMyShortcuts(withSample);
    await AsyncStorage.setItem(KEY_CHART_SAMPLE_MIGRATION_DONE, '1');
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return sortByOrder(ensureDefaults(JSON.parse(raw || '[]')));
  } catch {
    return list;
  }
}

export async function saveMyShortcuts(shortcuts: MyShortcut[]): Promise<void> {
  let normalized = ensureDefaults(shortcuts).map((s) => ({
    ...s,
    url: s.url && s.url.trim() ? normalizeUrl(s.url) : s.url,
  }));
  normalized = sortByOrder(normalized).map((s, i) => ({ ...s, sortOrder: i }));
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
}

export async function loadMyShortcuts(): Promise<MyShortcut[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return await persistInitialDefaults();
    }
    const parsed = JSON.parse(raw) as MyShortcut[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return await persistInitialDefaults();
    }
    let list = sortByOrder(ensureDefaults(parsed));
    list = await appendChartSampleIfLegacyUser(list);
    return list;
  } catch {
    return [
      { ...DEFAULT_FEAR_GREED, sortOrder: 0 },
      { ...DEFAULT_SAMPLE_CHART_VIDEO, sortOrder: 1 },
    ];
  }
}

/** 표시용 이모지 (비어 있으면 URL 추천) */
export function displayEmoji(s: MyShortcut): string {
  if (s.iconEmoji && s.iconEmoji.trim()) return s.iconEmoji.trim();
  return suggestedEmojiForUrl(s.url);
}

export function shortcutsForMain(list: MyShortcut[]): MyShortcut[] {
  return sortByOrder(list).filter((s) => s.showOnMain);
}

export async function addMyShortcut(input: {
  title: string;
  url: string;
  iconEmoji?: string;
  showOnMain: boolean;
}): Promise<MyShortcut[]> {
  const list = await loadMyShortcuts();
  const url = normalizeUrl(input.url);
  if (!url) throw new Error('URL이 필요합니다.');
  const emoji =
    input.iconEmoji && input.iconEmoji.trim()
      ? input.iconEmoji.trim()
      : suggestedEmojiForUrl(url);
  const maxOrder = Math.max(-1, ...list.map((s) => s.sortOrder));
  const title = input.title.trim() || deriveTitleFromUrl(url);
  const next: MyShortcut = {
    id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    title,
    url,
    iconEmoji: emoji,
    showOnMain: input.showOnMain,
    sortOrder: maxOrder + 1,
    isDefault: false,
  };
  await saveMyShortcuts([...list, next]);
  return loadMyShortcuts();
}

export async function updateMyShortcut(
  id: string,
  patch: Partial<Pick<MyShortcut, 'title' | 'url' | 'iconEmoji' | 'showOnMain'>>
): Promise<MyShortcut[]> {
  const list = await loadMyShortcuts();
  const next = list.map((s) => {
    if (s.id !== id) return s;
    const url = patch.url != null ? normalizeUrl(patch.url) : s.url;
    let iconEmoji: string;
    if (patch.iconEmoji !== undefined) {
      iconEmoji = patch.iconEmoji.trim() ? patch.iconEmoji.trim() : suggestedEmojiForUrl(url);
    } else {
      iconEmoji =
        s.iconEmoji && s.iconEmoji.trim() ? s.iconEmoji.trim() : suggestedEmojiForUrl(url);
    }
    const title =
      patch.title !== undefined
        ? patch.title.trim() || deriveTitleFromUrl(url)
        : s.title || deriveTitleFromUrl(url);
    return {
      ...s,
      title,
      url,
      iconEmoji,
      showOnMain: patch.showOnMain !== undefined ? patch.showOnMain : s.showOnMain,
    };
  });
  await saveMyShortcuts(next);
  return loadMyShortcuts();
}

export async function deleteMyShortcut(id: string): Promise<MyShortcut[]> {
  const list = await loadMyShortcuts();
  const target = list.find((s) => s.id === id);
  if (!target || target.isDefault) {
    return list;
  }
  const filtered = list.filter((s) => s.id !== id);
  await saveMyShortcuts(filtered);
  return loadMyShortcuts();
}

/** 정렬된 전체 목록에서 인접 항목과 sortOrder 교환 */
export async function reorderShortcutInList(id: string, direction: -1 | 1): Promise<MyShortcut[]> {
  const list = sortByOrder(await loadMyShortcuts());
  const idx = list.findIndex((s) => s.id === id);
  if (idx < 0) return list;
  const j = idx + direction;
  if (j < 0 || j >= list.length) return list;
  const a = list[idx];
  const b = list[j];
  const orderA = a.sortOrder;
  const orderB = b.sortOrder;
  const next = list.map((s) => {
    if (s.id === a.id) return { ...s, sortOrder: orderB };
    if (s.id === b.id) return { ...s, sortOrder: orderA };
    return s;
  });
  await saveMyShortcuts(next);
  return loadMyShortcuts();
}

/** 메인에 표시되는 항목만 골라 순서 변경 (sortOrder 스왑) */
export async function reorderMainVisible(id: string, direction: -1 | 1): Promise<MyShortcut[]> {
  const list = await loadMyShortcuts();
  const main = shortcutsForMain(list);
  const idx = main.findIndex((s) => s.id === id);
  if (idx < 0) return list;
  const j = idx + direction;
  if (j < 0 || j >= main.length) return list;
  const a = main[idx];
  const b = main[j];
  const orderA = a.sortOrder;
  const orderB = b.sortOrder;
  const next = list.map((s) => {
    if (s.id === a.id) return { ...s, sortOrder: orderB };
    if (s.id === b.id) return { ...s, sortOrder: orderA };
    return s;
  });
  await saveMyShortcuts(next);
  return loadMyShortcuts();
}
