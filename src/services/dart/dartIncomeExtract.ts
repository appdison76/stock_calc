import { dartFnlttNumericToWon, formatWonShortKr } from './dartFormatKr';

export type DartFnlttAmountKey = 'thstrm_amount' | 'thstrm_add_amount';

export interface DartFnlttRow {
  sj_div?: string;
  sj_nm?: string;
  account_nm?: string;
  /** 당기금액. 분·반기 (포괄)손익은 공식적으로 3개월 금액 */
  thstrm_amount?: string;
  /** 당기누적금액 (예: 3분기 제출 시 손익 누적 9개월) */
  thstrm_add_amount?: string;
}

function parseThousandWon(raw: string | undefined): number | null {
  if (raw == null || raw === '') return null;
  const t = String(raw).trim();
  if (t === '-' || t === '—' || t === 'N/A') return null;
  const n = Number(String(t).replace(/,/g, ''));
  if (!Number.isFinite(n)) return null;
  return n;
}

function isIncomeStatementRow(row: DartFnlttRow): boolean {
  const d = (row.sj_div || '').toUpperCase();
  if (d === 'CIS' || d === 'IS' || d === 'MCIS') return true;
  const nm = row.sj_nm || '';
  return nm.includes('포괄손익') || nm.includes('손익계산서');
}

/** 매출·영업이익·당기순이익 후보 행에서 금액 추출 (천원) */
export function extractRevenueOperatingThousandWon(
  rows: DartFnlttRow[],
  opts?: { amountKey?: DartFnlttAmountKey }
): {
  revenueThousand: number | null;
  operatingThousand: number | null;
  netIncomeThousand: number | null;
} {
  const amountKey: DartFnlttAmountKey = opts?.amountKey ?? 'thstrm_amount';
  const income = rows.filter(isIncomeStatementRow);
  let revenueThousand: number | null = null;
  let operatingThousand: number | null = null;
  let netIncomeThousand: number | null = null;

  /**
   * '매출액' 부분 문자열 매칭은 "매출액차감전영업이익" 등으로 이어져 비현실적 금액이 됨 → 엄격히.
   */
  const revenueScore = (name: string): number => {
    const n = name.replace(/\s/g, '');
    if (n === '매출액') return 100;
    if (n === '수익(매출액)' || n === '수익(매출)' || n === '수익') return 95;
    if (n.startsWith('수익') && n.includes('매출')) return 93;
    if (n.includes('IFRS') && n.includes('수익') && n.includes('매출')) return 88;
    if (n.includes('IFRS') && /revenue/i.test(name)) return 85;
    if (n === '매출') return 82;
    if (n === '영업수익') return 78;
    return 0;
  };

  const opScore = (name: string): number => {
    const n = name.replace(/\s/g, '');
    if (n === '영업이익') return 100;
    if (n.includes('영업이익') && !n.includes('률') && !n.includes('마진') && !n.includes('차감전')) return 75;
    return 0;
  };

  /** PER용 당기순이익 — 세전·총포괄 등 제외 */
  const netIncomeScore = (name: string): number => {
    const n = name.replace(/\s/g, '');
    if (n.includes('법인세차감전')) return 0;
    if (n.includes('총포괄손익')) return 0;
    if (n === '당기순이익') return 100;
    if (n.includes('지배기업의소유주에게귀속되는당기순이익')) return 99;
    if (n.includes('지배기업') && n.includes('당기순이익')) return 97;
    if (n.includes('지배') && n.includes('순이익') && n.includes('귀속')) return 96;
    if (n === '연결당기순이익') return 94;
    /** 분기·반기 공시에서 흔한 표기 (당기순이익과 별도 줄) */
    if (n.includes('분기순이익') || n.includes('분기순손익')) return 92;
    if (n.includes('반기순이익') || n.includes('반기순손익')) return 91;
    if (n.includes('당기순이익')) return 85;
    return 0;
  };

  /** 주 계정명 매칭 실패 시 — 매출·영업 줄과 겹치지 않게 보수적으로 */
  const netIncomeScoreRelaxed = (name: string): number => {
    const n = name.replace(/\s/g, '');
    if (n.includes('법인세차감전')) return 0;
    if (n.includes('총포괄손익')) return 0;
    if (n.includes('영업이익') || n.includes('매출')) return 0;
    if (n.includes('기타포괄')) return 0;
    if (n.includes('당기순이익') || n.includes('분기순이익') || n.includes('반기순이익')) return 55;
    if (n.includes('귀속') && n.includes('순이익')) return 50;
    if (n.includes('순이익') && (n.includes('지배') || n.includes('계속'))) return 48;
    return 0;
  };

  const rowAmount = (row: DartFnlttRow) => {
    if (amountKey === 'thstrm_add_amount') {
      return parseThousandWon(row.thstrm_add_amount);
    }
    const direct = parseThousandWon(row.thstrm_amount);
    if (direct != null) return direct;
    /** 사업보고서 등 일부 공시는 당기금액 대신 누적·당기만 add에 채우는 경우가 있음 */
    const d = (row.sj_div || '').toUpperCase();
    if (d === 'CIS' || d === 'IS' || d === 'MCIS') {
      return parseThousandWon(row.thstrm_add_amount);
    }
    return null;
  };

  const scan = (candidates: DartFnlttRow[]) => {
    let bestR = -1;
    let bestO = -1;
    let bestN = -1;
    let rev: number | null = null;
    let op: number | null = null;
    let net: number | null = null;
    for (const row of candidates) {
      const name = (row.account_nm || '').trim();
      if (!name) continue;
      const amt = rowAmount(row);
      if (amt == null) continue;
      const rs = revenueScore(name);
      if (rs > 0 && rs > bestR) {
        bestR = rs;
        rev = amt;
      }
      const os = opScore(name);
      if (os > 0 && os > bestO) {
        bestO = os;
        op = amt;
      }
      const ns = netIncomeScore(name);
      if (ns > 0 && ns > bestN) {
        bestN = ns;
        net = amt;
      }
    }
    return { rev, op, net };
  };

  /** 당기순이익만 thstrm_add에만 들어가는 분기·누적 공시 보조 */
  const scanNetAlternateAmountKey = (
    candidates: DartFnlttRow[],
    amountKey: DartFnlttAmountKey
  ): number | null => {
    let bestN = -1;
    let net: number | null = null;
    const rowAmtAlt = (row: DartFnlttRow): number | null => {
      if (amountKey === 'thstrm_add_amount') {
        return parseThousandWon(row.thstrm_add_amount);
      }
      return parseThousandWon(row.thstrm_amount);
    };
    for (const row of candidates) {
      const name = (row.account_nm || '').trim();
      if (!name) continue;
      const ns = Math.max(netIncomeScore(name), netIncomeScoreRelaxed(name));
      if (ns <= 0) continue;
      const amt = rowAmtAlt(row);
      if (amt == null) continue;
      if (ns > bestN) {
        bestN = ns;
        net = amt;
      }
    }
    return net;
  };

  const primary = scan(income);
  revenueThousand = primary.rev;
  operatingThousand = primary.op;
  netIncomeThousand = primary.net;
  /** 전체 행 폴백은 BS/CF 오인식 위험이 있어 CIS·IS만 추가 스캔 */
  if (revenueThousand == null || operatingThousand == null || netIncomeThousand == null) {
    const cisOnly = rows.filter((r) => {
      const d = (r.sj_div || '').toUpperCase();
      return d === 'CIS' || d === 'IS' || d === 'MCIS';
    });
    const fb = scan(cisOnly.length > 0 ? cisOnly : income);
    if (revenueThousand == null) revenueThousand = fb.rev;
    if (operatingThousand == null) operatingThousand = fb.op;
    if (netIncomeThousand == null) netIncomeThousand = fb.net;
  }

  /** 분기에서 당기순이익 줄만 금액 컬럼이 비어 있거나 누적(add) 전용인 경우 */
  if (netIncomeThousand == null) {
    const cisOnly = rows.filter((r) => {
      const d = (r.sj_div || '').toUpperCase();
      return d === 'CIS' || d === 'IS' || d === 'MCIS';
    });
    const pool = cisOnly.length > 0 ? cisOnly : income;
    let bestN = -1;
    let net: number | null = null;
    for (const row of pool) {
      const name = (row.account_nm || '').trim();
      if (!name) continue;
      const ns = netIncomeScoreRelaxed(name);
      if (ns <= 0) continue;
      const amt = rowAmount(row);
      if (amt == null) continue;
      if (ns > bestN) {
        bestN = ns;
        net = amt;
      }
    }
    netIncomeThousand = net;
  }
  if (netIncomeThousand == null) {
    const cisOnly = rows.filter((r) => {
      const d = (r.sj_div || '').toUpperCase();
      return d === 'CIS' || d === 'IS' || d === 'MCIS';
    });
    const pool = cisOnly.length > 0 ? cisOnly : income;
    netIncomeThousand =
      scanNetAlternateAmountKey(pool, 'thstrm_add_amount') ??
      scanNetAlternateAmountKey(pool, 'thstrm_amount');
  }

  return { revenueThousand, operatingThousand, netIncomeThousand };
}

export function formatPairFromThousandWon(
  revenueThousand: number | null,
  operatingThousand: number | null
): { revenueKr: string; operatingIncomeKr: string } {
  const fmt = (tw: number | null) => {
    if (tw == null) return '—';
    const won = dartFnlttNumericToWon(tw);
    if (!Number.isFinite(won)) return '—';
    return formatWonShortKr(won);
  };
  return {
    revenueKr: fmt(revenueThousand),
    operatingIncomeKr: fmt(operatingThousand),
  };
}
