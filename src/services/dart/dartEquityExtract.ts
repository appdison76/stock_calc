import type { DartFnlttRow } from './dartIncomeExtract';

function normalizeAccountName(name: string): string {
  return name.replace(/\s/g, '');
}

function parseThousandWon(raw: string | undefined): number | null {
  if (raw == null || raw === '') return null;
  const t = String(raw).trim();
  if (t === '-' || t === '—' || t === 'N/A') return null;
  const n = Number(String(t).replace(/,/g, ''));
  if (!Number.isFinite(n)) return null;
  return n;
}

function isBalanceSheetRow(row: DartFnlttRow): boolean {
  const d = (row.sj_div || '').toUpperCase();
  if (d === 'BS' || d === 'MCBS') return true;
  const nm = row.sj_nm || '';
  return nm.includes('재무상태표') || nm.includes('대차대조표');
}

/** PBR 분모 — 자본총계·지배주주지분 등 (천원) */
function equityScore(name: string): number {
  const n = normalizeAccountName(name);
  if (n === '자본총계') return 100;
  if (n.includes('지배') && n.includes('소유') && n.includes('지분')) return 98;
  if (n.includes('지배') && n.includes('귀속') && n.includes('자본')) return 96;
  if (n === '자기자본') return 90;
  if (n.includes('자본총계')) return 85;
  if (n.includes('순자산')) return 80;
  if (n.includes('자본') && n.includes('합계')) return 75;
  return 0;
}

function rowEquityAmount(row: DartFnlttRow): number | null {
  const direct = parseThousandWon(row.thstrm_amount);
  if (direct != null) return direct;
  return parseThousandWon(row.thstrm_add_amount);
}

/** 재무상태표에서 순자산(자본) 계정 추출 — thstrm_amount 기준 시점 잔액 */
export function extractEquityThousandWon(rows: DartFnlttRow[]): number | null {
  const bsRows = rows.filter(isBalanceSheetRow);
  const candidates = bsRows.length > 0 ? bsRows : rows;

  let best = -1;
  let equity: number | null = null;
  for (const row of candidates) {
    const name = (row.account_nm || '').trim();
    if (!name) continue;
    const score = equityScore(name);
    if (score <= 0) continue;
    const amt = rowEquityAmount(row);
    if (amt == null) continue;
    if (score > best) {
      best = score;
      equity = amt;
    }
  }
  return equity;
}
