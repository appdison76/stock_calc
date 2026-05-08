import { initDatabase } from './DatabaseService';
import {
  type DailySettlement,
  type DailySettlementBackupDay,
  type DailySettlementBackupPayload,
  type DailySettlementLine,
  type DailySettlementListItem,
  type DailySettlementMode,
  type PeriodTab,
  DAILY_SETTLEMENT_BACKUP_KIND,
  DAILY_SETTLEMENT_BACKUP_SCHEMA_VERSION,
} from '../models/DailySettlement';

/** 해당 일자 하루 손익 금액 (원, 정수) */
export function computeDayTotal(s: DailySettlement): number {
  if (s.mode === 'summary') {
    const v = s.summaryAmount;
    if (v == null || typeof v !== 'number' || !Number.isFinite(v)) return 0;
    return v;
  }
  return (s.lines ?? []).reduce((acc, l) => {
    const raw = l.amount;
    const n = typeof raw === 'number' ? raw : Number(raw);
    return acc + (Number.isFinite(n) ? n : 0);
  }, 0);
}

/** 영문 등 라틴 문자열은 대소문자 구분 없이 부분 일치 */
function memoIncludesQuery(text: string, queryTrimmed: string): boolean {
  return text.toLowerCase().includes(queryTrimmed.toLowerCase());
}

/** 메모 부분 검색: 빈 문자열이면 전체 합과 동일. 상세는 줄 메모, 요약은 일별 메모만 매칭 */
function computeFilteredDayTotal(s: DailySettlement, memoQueryTrimmed: string): number {
  if (!memoQueryTrimmed) return computeDayTotal(s);
  const q = memoQueryTrimmed;
  if (s.mode === 'summary') {
    const dm = s.dailyMemo ?? '';
    return memoIncludesQuery(dm, q) ? computeDayTotal(s) : 0;
  }
  return (s.lines ?? []).reduce((acc, l) => {
    const memo = l.memo ?? '';
    if (!memoIncludesQuery(memo, q)) return acc;
    const raw = l.amount;
    const n = typeof raw === 'number' ? raw : Number(raw);
    return acc + (Number.isFinite(n) ? n : 0);
  }, 0);
}

export function formatDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 이번 달 [start,end] 문자열 포함 범위 */
export function currentMonthRange(): { start: string; end: string } {
  const now = new Date();
  const y = now.getFullYear();
  const mo = now.getMonth();
  const start = formatDateKey(new Date(y, mo, 1));
  const last = new Date(y, mo + 1, 0);
  const end = formatDateKey(last);
  return { start, end };
}

export function currentYearRange(): { start: string; end: string } {
  const y = new Date().getFullYear();
  return {
    start: `${y}-01-01`,
    end: `${y}-12-31`,
  };
}

/** 오늘 하루 (시작=종료) */
export function todayDateRange(): { start: string; end: string } {
  const k = formatDateKey(new Date());
  return { start: k, end: k };
}

/** 직전 달력 달 1일~말일 */
export function lastMonthRange(): { start: string; end: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const start = formatDateKey(new Date(y, m - 1, 1));
  const end = formatDateKey(new Date(y, m, 0));
  return { start, end };
}

async function fetchLines(settlementId: number): Promise<DailySettlementLine[]> {
  const db = await initDatabase();
  const rows = await db.getAllAsync<{ id: number; sort_order: number; amount: number; memo: string | null }>(
    `SELECT id, sort_order, amount, memo FROM daily_settlement_lines WHERE settlement_id = ? ORDER BY sort_order ASC`,
    [settlementId]
  );
  return rows.map((r) => ({
    id: r.id,
    settlementId,
    sortOrder: r.sort_order,
    amount: r.amount,
    memo: r.memo ?? '',
  }));
}

export async function getSettlementByDate(dateKey: string): Promise<DailySettlement | null> {
  const db = await initDatabase();
  const row = await db.getFirstAsync<{
    id: number;
    date: string;
    mode: DailySettlementMode;
    summary_amount: number | null;
    daily_memo: string | null;
    updated_at: number;
  }>(
    `SELECT id, date, mode, summary_amount, daily_memo, updated_at FROM daily_settlements WHERE date = ?`,
    [dateKey]
  );
  if (!row) return null;
  const lines = await fetchLines(row.id);
  return {
    id: row.id,
    date: row.date,
    mode: row.mode,
    summaryAmount: row.summary_amount,
    dailyMemo: row.daily_memo ?? '',
    updatedAt: row.updated_at,
    lines,
  };
}

export async function deleteSettlementByDate(dateKey: string): Promise<void> {
  const db = await initDatabase();
  await db.runAsync(`DELETE FROM daily_settlements WHERE date = ?`, [dateKey]);
}

export async function saveSettlement(input: {
  date: string;
  mode: DailySettlementMode;
  summaryAmount: number | null;
  dailyMemo: string;
  lines: DailySettlementLine[];
}): Promise<void> {
  const db = await initDatabase();
  const now = Date.now();
  const existing = await db.getFirstAsync<{ id: number }>(
    `SELECT id FROM daily_settlements WHERE date = ?`,
    [input.date]
  );

  await db.execAsync('BEGIN TRANSACTION');
  try {
    let sid: number;
    if (existing) {
      sid = existing.id;
      await db.runAsync(`DELETE FROM daily_settlement_lines WHERE settlement_id = ?`, [sid]);
      await db.runAsync(
        `UPDATE daily_settlements SET mode = ?, summary_amount = ?, daily_memo = ?, updated_at = ? WHERE id = ?`,
        [
          input.mode,
          input.mode === 'summary' ? input.summaryAmount : null,
          input.dailyMemo || null,
          now,
          sid,
        ]
      );
    } else {
      const res = await db.runAsync(
        `INSERT INTO daily_settlements (date, mode, summary_amount, daily_memo, updated_at) VALUES (?, ?, ?, ?, ?)`,
        [
          input.date,
          input.mode,
          input.mode === 'summary' ? input.summaryAmount : null,
          input.dailyMemo || null,
          now,
        ]
      );
      sid = res.lastInsertRowId;
    }

    if (input.mode === 'detail') {
      for (let i = 0; i < input.lines.length; i++) {
        const ln = input.lines[i];
        await db.runAsync(
          `INSERT INTO daily_settlement_lines (settlement_id, sort_order, amount, memo) VALUES (?, ?, ?, ?)`,
          [sid, i, ln.amount, ln.memo || null]
        );
      }
    }

    await db.execAsync('COMMIT');
  } catch (e) {
    await db.execAsync('ROLLBACK');
    throw e;
  }
}

async function loadAllInRange(start: string, end: string): Promise<DailySettlement[]> {
  const db = await initDatabase();
  const rows = await db.getAllAsync<{
    id: number;
    date: string;
    mode: DailySettlementMode;
    summary_amount: number | null;
    daily_memo: string | null;
    updated_at: number;
  }>(
    `SELECT id, date, mode, summary_amount, daily_memo, updated_at FROM daily_settlements WHERE date >= ? AND date <= ? ORDER BY date DESC`,
    [start, end]
  );
  const out: DailySettlement[] = [];
  for (const row of rows) {
    const lines = row.mode === 'detail' ? await fetchLines(row.id) : [];
    out.push({
      id: row.id,
      date: row.date,
      mode: row.mode,
      summaryAmount: row.summary_amount,
      dailyMemo: row.daily_memo ?? '',
      updatedAt: row.updated_at,
      lines,
    });
  }
  return out;
}

export async function sumForRangeWithMemoFilter(
  start: string,
  end: string,
  memoQuery: string
): Promise<number> {
  let a = start;
  let b = end;
  if (a > b) [a, b] = [b, a];
  const items = await loadAllInRange(a, b);
  const q = memoQuery.trim();
  return items.reduce((s, x) => s + computeFilteredDayTotal(x, q), 0);
}

export async function sumForRange(start: string, end: string): Promise<number> {
  return sumForRangeWithMemoFilter(start, end, '');
}

/** 시작~종료 날짜(포함) 목록 — 문자열은 YYYY-MM-DD, 순서 바뀌어도 자동 교정 */
export async function listForDateRangeWithMemoFilter(
  start: string,
  end: string,
  memoQuery: string
): Promise<DailySettlementListItem[]> {
  let a = start;
  let b = end;
  if (a > b) [a, b] = [b, a];
  const full = await loadAllInRange(a, b);
  const q = memoQuery.trim();
  const mapped = full.map((s) => ({
    date: s.date,
    total: computeFilteredDayTotal(s, q),
    mode: s.mode,
    memoPreview: memoPreviewFrom(s),
  }));
  if (q) {
    return mapped.filter((row) => row.total !== 0);
  }
  return mapped;
}

export async function listForDateRange(start: string, end: string): Promise<DailySettlementListItem[]> {
  return listForDateRangeWithMemoFilter(start, end, '');
}

export async function sumForPeriod(tab: PeriodTab, filterYear?: number): Promise<number> {
  if (tab === 'month') {
    const { start, end } = currentMonthRange();
    return sumForRange(start, end);
  }
  if (tab === 'year') {
    const { start, end } = currentYearRange();
    return sumForRange(start, end);
  }
  // all
  if (filterYear != null) {
    return sumForRange(`${filterYear}-01-01`, `${filterYear}-12-31`);
  }
  const db = await initDatabase();
  const row = await db.getFirstAsync<{ mn: string | null; mx: string | null }>(
    `SELECT MIN(date) as mn, MAX(date) as mx FROM daily_settlements`
  );
  if (!row?.mn || !row?.mx) return 0;
  return sumForRange(row.mn, row.mx);
}

export async function listForPeriod(
  tab: PeriodTab,
  filterYear?: number
): Promise<DailySettlementListItem[]> {
  let start: string;
  let end: string;
  if (tab === 'month') {
    const r = currentMonthRange();
    start = r.start;
    end = r.end;
  } else if (tab === 'year') {
    const r = currentYearRange();
    start = r.start;
    end = r.end;
  } else {
    if (filterYear != null) {
      start = `${filterYear}-01-01`;
      end = `${filterYear}-12-31`;
    } else {
      const db = await initDatabase();
      const row = await db.getFirstAsync<{ mn: string | null; mx: string | null }>(
        `SELECT MIN(date) as mn, MAX(date) as mx FROM daily_settlements`
      );
      if (!row?.mn || !row?.mx) return [];
      start = row.mn;
      end = row.mx;
    }
  }

  const full = await loadAllInRange(start, end);
  return full.map((s) => ({
    date: s.date,
    total: computeDayTotal(s),
    mode: s.mode,
    memoPreview: memoPreviewFrom(s),
  }));
}

const MEMO_PREVIEW_MAX = 28;

/** 줄바꿈·연속 공백을 한 줄로 합침 */
function memoToSingleLine(text: string): string {
  return text
    .trim()
    .replace(/\s*\r?\n\s*/g, ' ')
    .replace(/ {2,}/g, ' ');
}

function truncateMemoPreview(singleLine: string): string {
  return singleLine.length > MEMO_PREVIEW_MAX
    ? singleLine.slice(0, MEMO_PREVIEW_MAX) + '…'
    : singleLine;
}

function memoPreviewFrom(s: DailySettlement): string {
  const dm = (s.dailyMemo || '').trim();
  if (dm) {
    return truncateMemoPreview(memoToSingleLine(dm));
  }
  if (s.mode === 'detail' && s.lines?.length) {
    const parts = s.lines
      .map((l) => memoToSingleLine(l.memo || ''))
      .filter((x) => x.length > 0);
    if (parts.length === 0) return '';
    return truncateMemoPreview(parts.join(' '));
  }
  return '';
}

/** 전체 탭용: 데이터가 있는 연도 목록 (내림차순) */
export async function getYearsWithData(): Promise<number[]> {
  const db = await initDatabase();
  const rows = await db.getAllAsync<{ y: string }>(
    `SELECT DISTINCT substr(date, 1, 4) as y FROM daily_settlements ORDER BY y DESC`
  );
  const ys = rows.map((r) => parseInt(r.y, 10)).filter((n) => !isNaN(n));
  const cy = new Date().getFullYear();
  if (!ys.includes(cy)) ys.unshift(cy);
  return [...new Set(ys)].sort((a, b) => b - a);
}

/** 백업용: 일일 정산 전체 (날짜 오름차순) */
export async function getAllSettlementsForBackup(): Promise<DailySettlement[]> {
  const all = await loadAllInRange('0000-01-01', '9999-12-31');
  return [...all].sort((a, b) => a.date.localeCompare(b.date));
}

export async function buildDailySettlementBackupPayload(): Promise<DailySettlementBackupPayload> {
  const settlementsRaw = await getAllSettlementsForBackup();
  const settlements: DailySettlementBackupDay[] = settlementsRaw.map((s) => ({
    date: s.date,
    mode: s.mode,
    summaryAmount: s.summaryAmount,
    dailyMemo: s.dailyMemo ?? '',
    lines:
      s.mode === 'detail'
        ? (s.lines ?? []).map((l) => ({
            amount: Math.round(l.amount),
            memo: l.memo ?? '',
          }))
        : [],
  }));
  return {
    schemaVersion: DAILY_SETTLEMENT_BACKUP_SCHEMA_VERSION,
    kind: DAILY_SETTLEMENT_BACKUP_KIND,
    exportedAt: new Date().toISOString(),
    settlements,
  };
}

export async function exportDailySettlementBackupJson(): Promise<string> {
  const payload = await buildDailySettlementBackupPayload();
  return JSON.stringify(payload, null, 2);
}

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseBackupDay(raw: unknown, index: number): DailySettlementBackupDay {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error(`settlements[${index}] 형식이 올바르지 않습니다.`);
  }
  const o = raw as Record<string, unknown>;
  const date = typeof o.date === 'string' ? o.date : '';
  if (!DATE_KEY_RE.test(date)) {
    throw new Error(`settlements[${index}].date 가 YYYY-MM-DD 형식이 아닙니다.`);
  }
  const mode = o.mode;
  if (mode !== 'summary' && mode !== 'detail') {
    throw new Error(`settlements[${index}].mode 가 summary 또는 detail 이 아닙니다.`);
  }
  const dailyMemo = typeof o.dailyMemo === 'string' ? o.dailyMemo : '';
  let summaryAmount: number | null = null;
  if (mode === 'summary') {
    if (o.summaryAmount !== null && o.summaryAmount !== undefined) {
      if (typeof o.summaryAmount !== 'number' || !Number.isFinite(o.summaryAmount)) {
        throw new Error(`settlements[${index}].summaryAmount 가 숫자가 아닙니다.`);
      }
      summaryAmount = Math.round(o.summaryAmount);
    }
  }
  const linesRaw = o.lines;
  const lines: { amount: number; memo: string }[] = [];
  if (mode === 'detail') {
    if (!Array.isArray(linesRaw)) {
      throw new Error(`settlements[${index}].lines 가 배열이 아닙니다.`);
    }
    linesRaw.forEach((lr, li) => {
      if (typeof lr !== 'object' || lr === null) {
        throw new Error(`settlements[${index}].lines[${li}] 형식 오류`);
      }
      const L = lr as Record<string, unknown>;
      const amt = L.amount;
      if (typeof amt !== 'number' || !Number.isFinite(amt)) {
        throw new Error(`settlements[${index}].lines[${li}].amount 오류`);
      }
      const memo = typeof L.memo === 'string' ? L.memo : '';
      lines.push({ amount: Math.round(amt), memo });
    });
  }
  return { date, mode, summaryAmount, dailyMemo, lines };
}

/** 백업 JSON 문자열 검증 후 페이로드 반환 */
export function parseDailySettlementBackupJson(jsonText: string): DailySettlementBackupPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error('JSON 형식이 아닙니다.');
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('백업 파일 내용이 올바르지 않습니다.');
  }
  const root = parsed as Record<string, unknown>;
  if (root.kind !== DAILY_SETTLEMENT_BACKUP_KIND) {
    throw new Error('일일 정산 백업 파일이 아닙니다.');
  }
  const sv = root.schemaVersion;
  if (sv !== DAILY_SETTLEMENT_BACKUP_SCHEMA_VERSION) {
    throw new Error(`지원하지 않는 백업 버전입니다 (v${String(sv)}).`);
  }
  const settlementsRaw = root.settlements;
  if (!Array.isArray(settlementsRaw)) {
    throw new Error('settlements 배열이 없습니다.');
  }
  const seenDates = new Set<string>();
  const settlements: DailySettlementBackupDay[] = settlementsRaw.map((item, i) => {
    const day = parseBackupDay(item, i);
    if (seenDates.has(day.date)) {
      throw new Error(`날짜가 중복되었습니다: ${day.date}`);
    }
    seenDates.add(day.date);
    return day;
  });
  const exportedAt =
    typeof root.exportedAt === 'string' ? root.exportedAt : new Date().toISOString();
  return {
    schemaVersion: DAILY_SETTLEMENT_BACKUP_SCHEMA_VERSION,
    kind: DAILY_SETTLEMENT_BACKUP_KIND,
    exportedAt,
    settlements,
  };
}

/** 기존 일일 정산 전체 삭제 후 백업 내용으로 교체 */
export async function replaceAllDailySettlementsFromBackup(
  payload: DailySettlementBackupPayload
): Promise<void> {
  const db = await initDatabase();
  const now = Date.now();
  await db.execAsync('BEGIN TRANSACTION');
  try {
    await db.runAsync(`DELETE FROM daily_settlement_lines`);
    await db.runAsync(`DELETE FROM daily_settlements`);

    for (const day of payload.settlements) {
      const res = await db.runAsync(
        `INSERT INTO daily_settlements (date, mode, summary_amount, daily_memo, updated_at) VALUES (?, ?, ?, ?, ?)`,
        [
          day.date,
          day.mode,
          day.mode === 'summary' ? day.summaryAmount : null,
          day.dailyMemo || null,
          now,
        ]
      );
      const sid = Number(res.lastInsertRowId);
      if (day.mode === 'detail') {
        for (let i = 0; i < day.lines.length; i++) {
          const ln = day.lines[i];
          await db.runAsync(
            `INSERT INTO daily_settlement_lines (settlement_id, sort_order, amount, memo) VALUES (?, ?, ?, ?)`,
            [sid, i, ln.amount, ln.memo || null]
          );
        }
      }
    }

    await db.execAsync('COMMIT');
  } catch (e) {
    await db.execAsync('ROLLBACK');
    throw e;
  }
}
