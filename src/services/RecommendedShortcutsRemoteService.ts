import { doc, getDoc } from 'firebase/firestore';
import { getFirestoreInstance } from './FirebaseService';
import type { RecommendedShortcut } from '../models/RecommendedShortcut';

export const RECOMMENDED_SHORTCUTS_COLLECTION = 'recommendedShortcuts';
export const RECOMMENDED_SHORTCUTS_DOC_ID = 'current';

function pickItemsArray(o: Record<string, unknown>): unknown[] | null {
  const candidates = ['items', 'shortcuts', 'links', 'recommendedShortcuts'];
  for (const key of candidates) {
    const v = o[key];
    if (Array.isArray(v)) return v;
  }
  return null;
}

function strField(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return String(v).trim();
}

/** 관리자·수동 입력에서 http → https 보정 (앱 표시/오픈용) */
function normalizeToHttpsUrl(url: string): string {
  const t = url.trim();
  if (/^http:\/\//i.test(t)) return `https://${t.slice(7)}`;
  return t;
}

function parseItems(data: unknown): RecommendedShortcut[] {
  if (!data || typeof data !== 'object') return [];
  const o = data as Record<string, unknown>;
  const raw = pickItemsArray(o);
  if (!raw) return [];

  const tmp: { sortOrder: number; item: RecommendedShortcut }[] = [];
  let i = 0;
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    if (e.showOnMain === false || e.enabled === false) continue;

    const title =
      strField(e.title) ||
      strField(e.name) ||
      strField(e.label);
    let url =
      strField(e.url) ||
      strField(e.link) ||
      strField(e.href);
    url = normalizeToHttpsUrl(url);
    if (!title || !url) continue;
    if (!/^https:\/\//i.test(url)) continue;

    const id =
      typeof e.id === 'string' && e.id.trim()
        ? e.id.trim()
        : `rs-${i++}`;
    const iconEmoji =
      typeof e.iconEmoji === 'string' && e.iconEmoji.trim() ? e.iconEmoji.trim() : undefined;

    let sortOrder = tmp.length;
    if (typeof e.sortOrder === 'number' && Number.isFinite(e.sortOrder)) {
      sortOrder = e.sortOrder;
    }
    tmp.push({ sortOrder, item: { id, title, url, iconEmoji } });
  }

  tmp.sort((a, b) => a.sortOrder - b.sortOrder);
  return tmp.map((t) => t.item);
}

/**
 * Firestore recommendedShortcuts/current 에서 추천 바로가기 목록을 가져온다.
 * 실패·문서 없음 시 빈 배열.
 */
export async function fetchRecommendedShortcutsFromRemote(): Promise<RecommendedShortcut[]> {
  try {
    const db = getFirestoreInstance();
    if (!db) {
      console.warn('[RecommendedShortcuts] Firestore 없음');
      return [];
    }
    const ref = doc(db, RECOMMENDED_SHORTCUTS_COLLECTION, RECOMMENDED_SHORTCUTS_DOC_ID);
    const snap = await getDoc(ref);
    if (!snap.exists) {
      return [];
    }
    const rawData = snap.data();
    const list = parseItems(rawData);
    if (list.length > 0) {
      console.log('[RecommendedShortcuts] Firestore recommendedShortcuts/current 사용:', list.length);
    } else {
      const keys = rawData && typeof rawData === 'object' ? Object.keys(rawData as object).join(',') : '';
      const arr = pickItemsArray((rawData || {}) as Record<string, unknown>);
      const arrLen = arr ? arr.length : 0;
      console.warn(
        '[RecommendedShortcuts] 문서는 있으나 표시할 항목이 0개입니다. 필드 키:',
        keys || '(없음)',
        '배열 길이:',
        arrLen,
        '(items·https URL·enabled=false 등을 확인하세요. Firestore 규칙에서 read 허용 여부도 확인)'
      );
    }
    return list;
  } catch (e: unknown) {
    const code = e && typeof e === 'object' && 'code' in e ? String((e as { code?: string }).code) : '';
    console.warn(
      '[RecommendedShortcuts] Firestore 읽기 실패:',
      code || e,
      '— 규칙에 match /recommendedShortcuts/{docId} { allow read: if true; } 가 있는지 확인하세요.'
    );
    return [];
  }
}
