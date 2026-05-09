/**
 * 해외 종목 실적 — Yahoo quoteSummary `incomeStatementHistory*` 모듈.
 * 금액은 Yahoo `financialCurrency`(예: USD, TWD) 단위로 오며, 1 단위당 원화 비율을 구해 DART 그리드와 동일한 DartCellBundle로 맞춥니다.
 *
 * 분기 키(`YYYYQx`): 손익 `endDate` **UTC 달력 분기** — 1~3월→YQ1, 4~6→YQ2, 7~9→YQ3, 10~12→YQ4.
 * (미국 회사 회계 분기·FY 명칭과 숫자가 다를 수 있음.)
 */
import type { DartCellBundle, DartFundamentalsGrid } from './dart/dartFundamentalsGrid';
import { formatWonShortKr } from './dart/dartFormatKr';
import {
  appendYahooCrumbQuery,
  extractYahooQuoteSummaryResult0,
  getStockQuote,
  invalidateYahooCrumbSession,
  YAHOO_QUERY_HOSTS,
  yahooGetCrumbSession,
  yahooRequestHeadersWithCookie,
} from './YahooFinanceService';

/** Metro·adb 필터: `[YAHOO_FS]` — 미국 등 Yahoo 손익 모듈 조회·파싱 확인 */
function yahooFsTrace(message: string, data?: Record<string, unknown>): void {
  if (data !== undefined) {
    console.warn('[YAHOO_FS]', message, data);
  } else {
    console.warn('[YAHOO_FS]', message);
  }
}

/** `(123)` · `1.2B` 등 Yahoo 표시 문자열 → 숫자 (영업이익만 raw 없이 올 때 대비) */
function parseYahooFormattedNumber(s: string): number | undefined {
  const t0 = s.trim();
  if (!t0 || t0 === '—' || t0 === '-') return undefined;
  const parenNeg = /^\(.*\)$/.test(t0);
  let core = parenNeg ? t0.slice(1, -1) : t0;
  core = core.replace(/,/g, '').replace(/\$/g, '').replace(/\u2212/g, '-').trim();
  let mult = 1;
  if (/[Bb]$/.test(core)) {
    mult = 1e9;
    core = core.slice(0, -1).trim();
  } else if (/[Mm]$/.test(core)) {
    mult = 1e6;
    core = core.slice(0, -1).trim();
  } else if (/[Kk]$/.test(core)) {
    mult = 1e3;
    core = core.slice(0, -1).trim();
  }
  const n = parseFloat(core);
  if (!Number.isFinite(n)) return undefined;
  const v = n * mult;
  return parenNeg ? -v : v;
}

function readYahooNumericField(v: unknown): number | undefined {
  if (v == null) return undefined;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'object' && v !== null && 'raw' in v) {
    const r = (v as { raw?: unknown }).raw;
    if (typeof r === 'number' && Number.isFinite(r)) return r;
  }
  if (typeof v === 'object' && v !== null) {
    const o = v as { longFmt?: string; fmt?: string };
    for (const key of ['longFmt', 'fmt'] as const) {
      const s = o[key];
      if (typeof s === 'string') {
        const n = parseYahooFormattedNumber(s);
        if (n != null && Number.isFinite(n)) return n;
      }
    }
  }
  return undefined;
}

/** 손익 행에서 Yahoo·타임시리즈 명칭 차이(파스칼/카멜)로 같은 값이 다른 키에 붙는 경우 */
function readFirstNumericFromRow(row: Record<string, unknown>, keys: readonly string[]): number | undefined {
  for (const k of keys) {
    const v = row[k];
    const n = readYahooNumericField(v);
    if (n != null && Number.isFinite(n)) return n;
  }
  return undefined;
}

/** Yahoo가 grossProfit을 비울 때: 매출 − 매출원가 (반도체 등에서 자주) */
function impliedGrossProfitUsd(row: Record<string, unknown>): number | undefined {
  const gp = readFirstNumericFromRow(row, ['grossProfit', 'GrossProfit']);
  if (gp != null && Number.isFinite(gp)) return gp;
  const rev = readFirstNumericFromRow(row, ['totalRevenue', 'TotalRevenue', 'operatingRevenue', 'OperatingRevenue']);
  const cor = readFirstNumericFromRow(row, ['costOfRevenue', 'CostOfRevenue']);
  if (rev != null && cor != null && Number.isFinite(rev) && Number.isFinite(cor)) {
    return rev - cor;
  }
  return undefined;
}

/** 일부 미국 종목(MU 등)은 operatingIncome 비우고 매출·비용만 줄 때가 있음 → 매출총이익 − 영업비용 성격 항목으로 근사 */
function deriveOperatingUsdFromComponents(row: Record<string, unknown>): number | null {
  const gp = impliedGrossProfitUsd(row);
  const toe = readFirstNumericFromRow(row, [
    'totalOperatingExpenses',
    'totalOperatingExpense',
    'operatingExpense',
    'OperatingExpense',
    'TotalOperatingExpenses',
  ]);
  if (gp != null && toe != null && Number.isFinite(gp) && Number.isFinite(toe)) {
    const x = gp - toe;
    return Number.isFinite(x) ? x : null;
  }
  if (gp == null || !Number.isFinite(gp)) return null;
  const sga =
    readYahooNumericField(row.sellingGeneralAdministrative) ??
    readYahooNumericField(row.sellingGeneralAndAdministration) ??
    readYahooNumericField(row.generalAndAdministrativeExpense);
  const rd =
    readYahooNumericField(row.researchAndDevelopment) ??
    readYahooNumericField(row.researchDevelopment);
  const oo = readYahooNumericField(row.otherOperatingExpenses);
  if (sga == null && rd == null && oo == null) return null;
  const x = gp - (sga ?? 0) - (rd ?? 0) - (oo ?? 0);
  return Number.isFinite(x) ? x : null;
}

/** operatingIncome·구성 항목이 모두 비었을 때: EBITDA − 감가·상각 (Yahoo에만 있을 수 있음) */
function operatingFromEbitdaLessDa(row: Record<string, unknown>): number | null {
  const e = readFirstNumericFromRow(row, ['ebitda', 'normalizedEBITDA', 'EBITDA', 'NormalizedEBITDA']);
  const d = readFirstNumericFromRow(row, [
    'reconciledDepreciation',
    'depreciationAndAmortization',
    'depreciation',
    'DepreciationAndAmortization',
  ]);
  if (e != null && d != null && Number.isFinite(e) && Number.isFinite(d)) {
    const x = e - d;
    return Number.isFinite(x) ? x : null;
  }
  return null;
}

function endDateToUnixSeconds(endDate: unknown): number | null {
  if (endDate == null) return null;
  if (typeof endDate === 'object' && endDate !== null && 'raw' in endDate) {
    const r = (endDate as { raw?: unknown }).raw;
    if (typeof r === 'number' && Number.isFinite(r)) {
      /** Yahoo가 밀리초 단위를 줄 때 연도가 어긋남 */
      return r > 1e12 ? Math.floor(r / 1000) : r;
    }
  }
  if (typeof endDate === 'object' && endDate !== null && 'fmt' in endDate) {
    const f = (endDate as { fmt?: string }).fmt;
    if (typeof f === 'string') {
      const t = Date.parse(f);
      if (Number.isFinite(t)) return Math.floor(t / 1000);
    }
  }
  return null;
}

function endDateFmtForLog(endDate: unknown): string {
  if (typeof endDate === 'object' && endDate !== null && 'fmt' in endDate) {
    const f = (endDate as { fmt?: string }).fmt;
    if (typeof f === 'string') return f;
  }
  return '—';
}

function statementDateFmt(field: unknown): string | null {
  if (typeof field !== 'object' || field === null || !('fmt' in field)) return null;
  const f = (field as { fmt?: string }).fmt;
  return typeof f === 'string' && f.trim() ? f.trim() : null;
}

/** Yahoo 손익 행: `startDate`·`endDate` 있으면 FROM ~ TO, 없으면 ~ 종료만 */
function fsPeriodLabelFromIncomeRow(row: Record<string, unknown>): string | undefined {
  const endFmt = statementDateFmt(row.endDate);
  const startFmt = statementDateFmt(row.startDate);
  if (startFmt && endFmt) return `${startFmt} ~ ${endFmt}`;
  if (endFmt) return `~ ${endFmt}`;
  return undefined;
}

/**
 * 연간 표 periodKey(연 문자열): 종료일 **UTC 달력 연도** (1·2월 종료도 그 해 숫자).
 */
function annualPeriodKeyFromFiscalYearEndUtc(sec: number): string {
  const d = new Date(sec * 1000);
  return String(d.getUTCFullYear());
}

/**
 * quoteSummary 연간 손익 `endDate`: **fmt** 우선(UTC 해석 오차 방지), 연 슬롯은 종료일의 달력 연도.
 */
function annualYearKeyFromIncomeStatementRow(row: Record<string, unknown>): string | null {
  const ed = row.endDate;
  if (typeof ed !== 'object' || ed === null) return null;
  const fmt = 'fmt' in ed ? (ed as { fmt?: string }).fmt : undefined;
  if (typeof fmt === 'string') {
    const t = fmt.trim();
    const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
    if (iso) {
      const y = parseInt(iso[1], 10);
      return String(y);
    }
    const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
    if (us) {
      const y = parseInt(us[3], 10);
      return String(y);
    }
  }
  const sec = endDateToUnixSeconds(ed);
  if (sec != null) return annualPeriodKeyFromFiscalYearEndUtc(sec);
  return null;
}

/** fundamentals-timeseries 연간 `asOfDate`: 종료일 달력 연도. 분기 TS는 `yahooQuarterPeriodKeyFromEndDateUnix`. */
function annualYearKeyFromTsAsOfDate(ad: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ad.trim());
  if (m) {
    const y = parseInt(m[1], 10);
    return String(y);
  }
  const sec = Math.floor(Date.parse(ad.includes('T') ? ad : `${ad}T12:00:00.000Z`) / 1000);
  if (!Number.isFinite(sec)) return null;
  return annualPeriodKeyFromFiscalYearEndUtc(sec);
}

/** 분기 손익·시계열: 종료일 UTC 기준 달력 분기. */
function yahooQuarterPeriodKeyFromEndDateUnix(sec: number): string {
  const d = new Date(sec * 1000);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const q = Math.floor((m - 1) / 3) + 1;
  return `${y}Q${q}`;
}

function extractUsdLine(row: Record<string, unknown>): {
  revenue: number | null;
  operating: number | null;
  net: number | null;
} {
  const revenue =
    readFirstNumericFromRow(row, [
      'totalRevenue',
      'TotalRevenue',
      'operatingRevenue',
      'OperatingRevenue',
      'totalRevenueRaw',
    ]) ?? null;
  /** quoteSummary 행만으로는 MU 등에서 영업이익이 비거나 0으로만 옴 → 별도 timeseries 병합 */
  const operating =
    readFirstNumericFromRow(row, [
      'totalOperatingIncomeAsReported',
      'TotalOperatingIncomeAsReported',
      'reconciledOperatingIncome',
      'totalOperatingIncome',
      'TotalOperatingIncome',
      'operatingIncome',
      'OperatingIncome',
      'operatingIncomeLoss',
      'OperatingIncomeLoss',
      'ebit',
      'EBIT',
      'normalizedEBIT',
      'NormalizedEBIT',
    ]) ??
    deriveOperatingUsdFromComponents(row) ??
    operatingFromEbitdaLessDa(row) ??
    null;
  const net =
    readFirstNumericFromRow(row, [
      'netIncome',
      'NetIncome',
      'netIncomeApplicableToCommonShares',
      'netIncomeCommonStockholders',
      'NetIncomeCommonStockholders',
    ]) ?? null;
  return {
    revenue: revenue != null && Number.isFinite(revenue) ? revenue : null,
    operating: operating != null && Number.isFinite(operating) ? operating : null,
    net: net != null && Number.isFinite(net) ? net : null,
  };
}

/** 연결 재무제표가 표시하는 통화(ADR라도 본사 결산 통화가 TWD 등일 수 있음) */
function extractStatementReportingCurrency(r0: Record<string, unknown> | undefined): string {
  if (r0 == null) return 'USD';
  const dks = r0.defaultKeyStatistics as Record<string, unknown> | undefined;
  const sd = r0.summaryDetail as Record<string, unknown> | undefined;
  const raw =
    (typeof dks?.financialCurrency === 'string' && dks.financialCurrency.trim()) ||
    (typeof sd?.financialCurrency === 'string' && sd.financialCurrency.trim()) ||
    '';
  return raw ? raw.toUpperCase() : 'USD';
}

/** Yahoo가 ADR에 USD만 적어줘도 실제 손익은 본사 통화인 경우 (손익 환산용). 티커 베이스(예: TSM, ASML) */
const STATEMENT_CURRENCY_OVERRIDE: Record<string, string> = {
  /** TSMC ADR: 손익은 대개 TWD 연결 기준 */
  TSM: 'TWD',
};

function statementCurrencyBaseTicker(yahooSymbol: string): string {
  const u = yahooSymbol.trim().toUpperCase();
  const dot = u.indexOf('.');
  return dot >= 0 ? u.slice(0, dot) : u;
}

/** API financialCurrency + 알려진 ADR 예외 */
function resolveStatementCurrencyFromQuote(yahooSymbol: string, r0: Record<string, unknown> | undefined): string {
  const fromApi = extractStatementReportingCurrency(r0);
  const base = statementCurrencyBaseTicker(yahooSymbol);
  const forced = STATEMENT_CURRENCY_OVERRIDE[base];
  if (forced != null && forced !== '') {
    if (forced !== fromApi.toUpperCase()) {
      yahooFsTrace('stmt_currency_override', { yahooSymbol, fromApi, forced });
    }
    return forced.toUpperCase();
  }
  return fromApi;
}

async function tryFxPrice(
  pairSymbol: string,
  minPrice: number,
  maxPrice: number
): Promise<number | undefined> {
  try {
    const q = await getStockQuote(pairSymbol);
    if (
      q != null &&
      Number.isFinite(q.price) &&
      q.price > minPrice &&
      q.price < maxPrice
    ) {
      return q.price;
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

/**
 * 손익 `raw` 숫자 1 단위당 원화.
 * - 우선 `통화코드KRW=X` 직접 환율
 * - 없으면 통화별 USD 브리지(EURUSD·USDJPY·USDTWD 등)
 */
async function resolveKrwPerStatementUnit(stmtCurrency: string, usdKrwRate: number): Promise<number> {
  const c = stmtCurrency.trim().toUpperCase();
  if (c === 'USD' || c === 'US$') return usdKrwRate;

  const direct = await tryFxPrice(`${c}KRW=X`, 1e-8, 1e8);
  if (direct != null) {
    yahooFsTrace('stmt_fx', { pair: `${c}KRW=X`, krwPerStmtUnit: direct });
    return direct;
  }

  /** TWD: TWDKRW 실패 시 USDTWD (TWD/USD) */
  if (c === 'TWD') {
    const usdTwd = await tryFxPrice('USDTWD=X', 1, 1000);
    if (usdTwd != null) {
      const krwPerTwd = usdKrwRate / usdTwd;
      yahooFsTrace('stmt_fx', {
        pair: 'USDTWD=X',
        twdPerUsd: usdTwd,
        krwPerTwd,
      });
      return krwPerTwd;
    }
    yahooFsTrace('stmt_fx_twd_fallback', { stmtCurrency: c });
    return usdKrwRate / 32;
  }

  /** EUR·GBP·AUD·NZD: EURUSD 등 = USD per 1 단위 → × USDKRW */
  const usdPerUnitMap: Record<string, string> = {
    EUR: 'EURUSD=X',
    GBP: 'GBPUSD=X',
    AUD: 'AUDUSD=X',
    NZD: 'NZDUSD=X',
  };
  const usdPair = usdPerUnitMap[c];
  if (usdPair != null) {
    const usdPerUnit = await tryFxPrice(usdPair, 1e-4, 1e4);
    if (usdPerUnit != null) {
      const k = usdPerUnit * usdKrwRate;
      yahooFsTrace('stmt_fx', { pair: usdPair, bridge: 'usdPerUnit_x_usdkrw', krwPerStmtUnit: k });
      return k;
    }
  }

  /** JPY: USDJPY = 엔/USD → 원/엔 = USDKRW / USDJPY */
  if (c === 'JPY') {
    const usdjpy = await tryFxPrice('USDJPY=X', 50, 400);
    if (usdjpy != null) {
      const k = usdKrwRate / usdjpy;
      yahooFsTrace('stmt_fx', { pair: 'USDJPY=X', bridge: 'inverse_jpy', krwPerStmtUnit: k });
      return k;
    }
  }

  /** CAD: USDCAD = CAD/USD → 원/CAD = USDKRW / USDCAD */
  if (c === 'CAD') {
    const usdcad = await tryFxPrice('USDCAD=X', 0.5, 4);
    if (usdcad != null) {
      const k = usdKrwRate / usdcad;
      yahooFsTrace('stmt_fx', { pair: 'USDCAD=X', krwPerStmtUnit: k });
      return k;
    }
  }

  /** CNY·CNH: 미국 달러당 위안 → 원/위안 */
  if (c === 'CNY' || c === 'CNH') {
    const pair = c === 'CNH' ? 'USDCNH=X' : 'USDCNY=X';
    const usdCny = await tryFxPrice(pair, 4, 15);
    if (usdCny != null) {
      const k = usdKrwRate / usdCny;
      yahooFsTrace('stmt_fx', { pair, krwPerStmtUnit: k });
      return k;
    }
  }

  /** HKD, SGD, INR: USD당 해당통화 */
  const usdPerLocalMap: Record<string, string> = {
    HKD: 'USDHKD=X',
    SGD: 'USDSGD=X',
    INR: 'USDINR=X',
    MXN: 'USDMXN=X',
    BRL: 'USDBRL=X',
    SEK: 'USDSEK=X',
    NOK: 'USDNOK=X',
    DKK: 'USDDKK=X',
    PLN: 'USDPLN=X',
    TRY: 'USDTRY=X',
    ZAR: 'USDZAR=X',
  };
  const ul = usdPerLocalMap[c];
  if (ul != null) {
    const rate = await tryFxPrice(ul, 1e-4, 1e6);
    if (rate != null) {
      const k = usdKrwRate / rate;
      yahooFsTrace('stmt_fx', { pair: ul, krwPerStmtUnit: k });
      return k;
    }
  }

  /** CHF: USDCHF = CHF/USD 구간이 많음 → 원/CHF = USDKRW / USDCHF */
  if (c === 'CHF') {
    const usdchf = await tryFxPrice('USDCHF=X', 0.3, 5);
    if (usdchf != null) {
      const k = usdKrwRate / usdchf;
      yahooFsTrace('stmt_fx', { pair: 'USDCHF=X', krwPerStmtUnit: k });
      return k;
    }
  }

  yahooFsTrace('stmt_fx_unknown_currency', { stmtCurrency: c });
  return usdKrwRate;
}

function bundleFromStatementCurrency(
  revenueStmt: number | null,
  operatingStmt: number | null,
  netStmt: number | null,
  krwPerStmtUnit: number,
  fsPeriodLabel?: string | null
): DartCellBundle {
  const toWon = (raw: number | null) =>
    raw != null && Number.isFinite(raw) ? raw * krwPerStmtUnit : null;
  const revWon = toWon(revenueStmt);
  const opWon = toWon(operatingStmt);
  const netWon = toWon(netStmt);

  return {
    revenueKr: revWon != null ? formatWonShortKr(revWon) : '—',
    operatingIncomeKr: opWon != null ? formatWonShortKr(opWon) : '—',
    marketCapKr: '—',
    per: '—',
    netIncomeWon: netWon,
    operatingIncomeWon: opWon,
    ...(fsPeriodLabel ? { fsPeriodLabel } : {}),
  };
}

type ParsedMaps = {
  annualByYear: Map<string, DartCellBundle>;
  quarterlyByPeriod: Map<string, DartCellBundle>;
};

/** quoteSummary `r0`에서 시총(거래소 통화) — getStockQuote와 중복 요청을 줄이기 위해 손익 fetch와 같이 씀 */
function shareCountFromQuoteSummaryR0(r0: Record<string, unknown>): number | undefined {
  const dks = r0.defaultKeyStatistics as Record<string, unknown> | undefined;
  const sd = r0.summaryDetail as Record<string, unknown> | undefined;
  const candidates: unknown[] = [
    dks?.sharesOutstanding,
    dks?.floatShares,
    dks?.impliedSharesOutstanding,
    sd?.sharesOutstanding,
  ];
  for (const c of candidates) {
    const n = readYahooNumericField(c);
    if (n != null && Number.isFinite(n) && n > 0) return n;
  }
  return undefined;
}

function extractQuoteSummaryCapMeta(r0: Record<string, unknown>): { marketCap?: number; currency?: string } {
  const sd = r0.summaryDetail as Record<string, unknown> | undefined;
  const dks = r0.defaultKeyStatistics as Record<string, unknown> | undefined;
  const priceMod = r0.price as Record<string, unknown> | undefined;

  let marketCap =
    readYahooNumericField(sd?.marketCap) ?? readYahooNumericField(dks?.marketCap);

  const price =
    readYahooNumericField(priceMod?.regularMarketPrice) ??
    readYahooNumericField(priceMod?.regularMarketPreviousClose);

  if ((marketCap == null || !Number.isFinite(marketCap) || marketCap <= 0) && price != null && price > 0) {
    const sh = shareCountFromQuoteSummaryR0(r0);
    if (sh != null) marketCap = sh * price;
  }

  const currencyRaw =
    (typeof sd?.currency === 'string' && sd.currency) ||
    (typeof priceMod?.currency === 'string' && priceMod.currency) ||
    (typeof dks?.financialCurrency === 'string' && dks.financialCurrency) ||
    'USD';

  const mc =
    marketCap != null && Number.isFinite(marketCap) && marketCap > 0 ? marketCap : undefined;
  return { marketCap: mc, currency: currencyRaw };
}

export type YahooFundamentalsFetchResult = {
  parsed: ParsedMaps | null;
  marketCap?: number;
  currency?: string;
};

/** query2 timeseries — crumb 불필요, Yahoo 웹과 동일 `OperatingIncome` 시계열(MU 등 quoteSummary 행이 부정확할 때) */
const YAHOO_FUNDAMENTALS_TS_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

type TsPointEntry = { asOfDate?: string; reportedValue?: { raw?: number } };

type YahooFundamentalsTimeseriesPayload = {
  quarterlyOperating: TsPointEntry[];
  annualOperating: TsPointEntry[];
  quarterlyRevenue: TsPointEntry[];
  annualRevenue: TsPointEntry[];
};

/** 2000-01-01 UTC — 너무 짧은 period1이면 과거 달력 분기(예: 2024 Q1~3) 시계열이 비는 경우가 있음 */
const YAHOO_FUNDAMENTALS_TS_PERIOD1 = 946684800;

const TS_FETCH_HEADERS = {
  'User-Agent': YAHOO_FUNDAMENTALS_TS_UA,
  Accept: 'application/json',
} as const;

function appendFundamentalsTimeseriesBlocks(
  out: YahooFundamentalsTimeseriesPayload,
  data: { timeseries?: { result?: Array<Record<string, unknown>> } }
): void {
  for (const block of data.timeseries?.result ?? []) {
    const meta = block.meta as { type?: string[] } | undefined;
    const typ = meta?.type?.[0];
    if (typ === 'quarterlyOperatingIncome' && Array.isArray(block.quarterlyOperatingIncome)) {
      out.quarterlyOperating.push(...(block.quarterlyOperatingIncome as TsPointEntry[]));
    }
    if (typ === 'annualOperatingIncome' && Array.isArray(block.annualOperatingIncome)) {
      out.annualOperating.push(...(block.annualOperatingIncome as TsPointEntry[]));
    }
    if (typ === 'quarterlyTotalRevenue' && Array.isArray(block.quarterlyTotalRevenue)) {
      out.quarterlyRevenue.push(...(block.quarterlyTotalRevenue as TsPointEntry[]));
    }
    if (typ === 'annualTotalRevenue' && Array.isArray(block.annualTotalRevenue)) {
      out.annualRevenue.push(...(block.annualTotalRevenue as TsPointEntry[]));
    }
  }
}

/**
 * 통합 요청 + 분기 매출·영업 **단독** 요청을 합침.
 * type을 한 번에만 묶으면 분기 포인트 개수가 줄어드는 경우가 있어, 과거 분기 열(예: 2024 Q1~3) 보강용.
 */
async function fetchYahooFundamentalsTimeseriesMaps(symbol: string): Promise<YahooFundamentalsTimeseriesPayload> {
  const period1 = YAHOO_FUNDAMENTALS_TS_PERIOD1;
  const period2 = Math.floor(Date.now() / 1000) + 86400 * 400;
  const q = encodeURIComponent(symbol);
  const base = `https://query2.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${q}?symbol=${q}&period1=${period1}&period2=${period2}`;
  const empty = (): YahooFundamentalsTimeseriesPayload => ({
    quarterlyOperating: [],
    annualOperating: [],
    quarterlyRevenue: [],
    annualRevenue: [],
  });
  try {
    const typesAll =
      'quarterlyOperatingIncome,annualOperatingIncome,quarterlyTotalRevenue,annualTotalRevenue';
    const [resAll, resQop, resQrev] = await Promise.all([
      fetch(`${base}&type=${encodeURIComponent(typesAll)}`, { headers: TS_FETCH_HEADERS }),
      fetch(`${base}&type=${encodeURIComponent('quarterlyOperatingIncome')}`, { headers: TS_FETCH_HEADERS }),
      fetch(`${base}&type=${encodeURIComponent('quarterlyTotalRevenue')}`, { headers: TS_FETCH_HEADERS }),
    ]);

    const out = empty();
    let anyOk = false;
    for (const res of [resAll, resQop, resQrev]) {
      if (!res.ok) continue;
      anyOk = true;
      const data = (await res.json()) as {
        timeseries?: { result?: Array<Record<string, unknown>> };
      };
      appendFundamentalsTimeseriesBlocks(out, data);
    }

    if (!anyOk) {
      yahooFsTrace('ts_fundamentals_http', {
        symbol,
        statusAll: resAll.status,
        statusQop: resQop.status,
        statusQrev: resQrev.status,
      });
      return empty();
    }

    yahooFsTrace('ts_fundamentals_fetch_ok', {
      symbol,
      qOp: out.quarterlyOperating.length,
      aOp: out.annualOperating.length,
      qRev: out.quarterlyRevenue.length,
      aRev: out.annualRevenue.length,
      period1,
    });
    return out;
  } catch (e: unknown) {
    yahooFsTrace('ts_fundamentals_fetch_err', {
      symbol,
      message: e instanceof Error ? e.message : String(e),
    });
    return empty();
  }
}

function mergeFundamentalsTimeseriesIntoParsed(
  parsed: ParsedMaps,
  ts: YahooFundamentalsTimeseriesPayload,
  krwPerStmtUnit: number,
  logSymbol?: string
): void {
  const mergeOp = (b: DartCellBundle, opStmt: number): DartCellBundle => {
    const opWon = opStmt * krwPerStmtUnit;
    return {
      ...b,
      operatingIncomeKr: formatWonShortKr(opWon),
      operatingIncomeWon: opWon,
    };
  };
  const mergeRev = (b: DartCellBundle, revStmt: number): DartCellBundle => {
    const revWon = revStmt * krwPerStmtUnit;
    return {
      ...b,
      revenueKr: formatWonShortKr(revWon),
    };
  };

  const accumulateQuarterly = (
    entries: TsPointEntry[],
    pick: (b: DartCellBundle, raw: number) => DartCellBundle
  ): Map<string, { sec: number; raw: number; asOfDate: string }> => {
    const best = new Map<string, { sec: number; raw: number; asOfDate: string }>();
    for (const entry of entries) {
      const raw = entry.reportedValue?.raw;
      if (typeof raw !== 'number' || !Number.isFinite(raw)) continue;
      const ad = entry.asOfDate;
      if (typeof ad !== 'string') continue;
      const sec = Math.floor(
        Date.parse(ad.includes('T') ? ad : `${ad}T12:00:00.000Z`) / 1000
      );
      if (!Number.isFinite(sec)) continue;
      const pk = yahooQuarterPeriodKeyFromEndDateUnix(sec);
      const prev = best.get(pk);
      if (!prev || sec >= prev.sec) best.set(pk, { sec, raw, asOfDate: ad.trim() });
    }
    /** quoteSummary에 해당 분기 행이 없어도 시계열이 있으면 채움 — 분기 모드에서 해외 종목 첫 표가 비는 주 원인 */
    for (const [pk, v] of best) {
      const existing = parsed.quarterlyByPeriod.get(pk);
      const base = existing ?? bundleFromStatementCurrency(null, null, null, krwPerStmtUnit);
      const picked = pick(base, v.raw);
      const tsLabel = `~ ${v.asOfDate}`;
      parsed.quarterlyByPeriod.set(pk, {
        ...picked,
        ...(!picked.fsPeriodLabel ? { fsPeriodLabel: tsLabel } : {}),
      });
    }
    return best;
  };

  const accumulateAnnual = (
    entries: TsPointEntry[],
    pick: (b: DartCellBundle, raw: number) => DartCellBundle
  ): Map<string, { sec: number; raw: number; asOfDate: string }> => {
    const best = new Map<string, { sec: number; raw: number; asOfDate: string }>();
    for (const entry of entries) {
      const raw = entry.reportedValue?.raw;
      if (typeof raw !== 'number' || !Number.isFinite(raw)) continue;
      const ad = entry.asOfDate;
      if (typeof ad !== 'string') continue;
      const yk = annualYearKeyFromTsAsOfDate(ad);
      if (yk == null) continue;
      const sec = Math.floor(
        Date.parse(ad.includes('T') ? ad : `${ad}T12:00:00.000Z`) / 1000
      );
      if (!Number.isFinite(sec)) continue;
      const prev = best.get(yk);
      if (!prev || sec >= prev.sec) best.set(yk, { sec, raw, asOfDate: ad.trim() });
    }
    for (const [yk, v] of best) {
      const b = parsed.annualByYear.get(yk);
      if (b) {
        const picked = pick(b, v.raw);
        const tsLabel = `~ ${v.asOfDate}`;
        parsed.annualByYear.set(yk, {
          ...picked,
          ...(!picked.fsPeriodLabel ? { fsPeriodLabel: tsLabel } : {}),
        });
      }
    }
    return best;
  };

  const qOp = accumulateQuarterly(ts.quarterlyOperating, mergeOp);
  const qRev = accumulateQuarterly(ts.quarterlyRevenue, mergeRev);
  const aOp = accumulateAnnual(ts.annualOperating, mergeOp);
  const aRev = accumulateAnnual(ts.annualRevenue, mergeRev);

  if (logSymbol) {
    yahooFsTrace('ts_fundamentals_merged', {
      symbol: logSymbol,
      quarterlyKeysOp: [...qOp.keys()],
      quarterlyKeysRev: [...qRev.keys()],
      annualKeysOp: [...aOp.keys()],
      annualKeysRev: [...aRev.keys()],
    });
  }
}

function parseIncomeHistoryModules(
  r0: Record<string, unknown> | undefined,
  krwPerStmtUnit: number,
  logSymbol?: string
): ParsedMaps {
  const annualByYear = new Map<string, DartCellBundle>();
  const quarterlyByPeriod = new Map<string, DartCellBundle>();

  const annualMod = r0?.incomeStatementHistory as { incomeStatementHistory?: unknown[] } | undefined;
  const annualRows = Array.isArray(annualMod?.incomeStatementHistory)
    ? (annualMod!.incomeStatementHistory as Record<string, unknown>[])
    : [];

  /** 연간: 종료일 연도를 키로 — 같은 연도 여러 행이면 endDate가 더 늦은 쪽 */
  const annualBest = new Map<
    string,
    { sec: number; bundle: DartCellBundle; revenueUsd: number | null }
  >();
  for (const row of annualRows) {
    const sec = endDateToUnixSeconds(row.endDate);
    if (sec == null) continue;
    const yearKey = annualYearKeyFromIncomeStatementRow(row);
    if (yearKey == null || yearKey === '') continue;
    const { revenue, operating, net } = extractUsdLine(row);
    const bundle = bundleFromStatementCurrency(
      revenue,
      operating,
      net,
      krwPerStmtUnit,
      fsPeriodLabelFromIncomeRow(row)
    );
    const prev = annualBest.get(yearKey);
    if (!prev || sec >= prev.sec) {
      annualBest.set(yearKey, { sec, bundle, revenueUsd: revenue });
    }
  }
  annualBest.forEach((v, k) => annualByYear.set(k, v.bundle));

  const qMod = r0?.incomeStatementHistoryQuarterly as { incomeStatementHistory?: unknown[] } | undefined;
  const qRows = Array.isArray(qMod?.incomeStatementHistory)
    ? (qMod!.incomeStatementHistory as Record<string, unknown>[])
    : [];

  if (logSymbol && annualRows.length === 0 && qRows.length === 0) {
    yahooFsTrace('income_no_statement_rows', {
      symbol: logSymbol,
      topKeys: r0 != null ? Object.keys(r0) : [],
      hadAnnualModule: annualMod != null,
      hadQuarterlyModule: qMod != null,
    });
  }

  const quarterBest = new Map<
    string,
    { sec: number; bundle: DartCellBundle; revenueUsd: number | null; endDateFmt: string }
  >();
  for (const row of qRows) {
    const sec = endDateToUnixSeconds(row.endDate);
    if (sec == null) continue;
    const quarterKey = yahooQuarterPeriodKeyFromEndDateUnix(sec);
    const { revenue, operating, net } = extractUsdLine(row);
    const bundle = bundleFromStatementCurrency(
      revenue,
      operating,
      net,
      krwPerStmtUnit,
      fsPeriodLabelFromIncomeRow(row)
    );
    const endDateFmt = endDateFmtForLog(row.endDate);
    const prev = quarterBest.get(quarterKey);
    if (!prev || sec >= prev.sec) {
      quarterBest.set(quarterKey, { sec, bundle, revenueUsd: revenue, endDateFmt });
    }
  }
  quarterBest.forEach((v, k) => quarterlyByPeriod.set(k, v.bundle));

  if (logSymbol) {
    yahooFsTrace('income_raw_counts', {
      symbol: logSymbol,
      annualRowsFromApi: annualRows.length,
      quarterlyRowsFromApi: qRows.length,
      krwPerStmtUnit,
    });
    const annualSummary = [...annualBest.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([yearKey, v]) => ({
        yearKey,
        endDateUtc: new Date(v.sec * 1000).toISOString().slice(0, 10),
        revenueUsd: v.revenueUsd,
      }));
    yahooFsTrace('income_annual_merged', {
      symbol: logSymbol,
      count: annualSummary.length,
      rows: annualSummary,
    });
    const qSummary = [...quarterBest.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([periodKey, v]) => ({
        periodKey,
        endDateYahoo: v.endDateFmt,
        endDateUtc: new Date(v.sec * 1000).toISOString().slice(0, 10),
        revenueUsd: v.revenueUsd,
      }));
    yahooFsTrace('income_quarterly_merged', {
      symbol: logSymbol,
      count: qSummary.length,
      rows: qSummary,
    });
  }

  return { annualByYear, quarterlyByPeriod };
}

export async function fetchYahooIncomeStatementModules(
  normalizedSymbol: string,
  usdKrwRate: number
): Promise<YahooFundamentalsFetchResult> {
  /** 손익 + 시총 한 번에 — 기초비교 화면에서 해외 종목마다 getStockQuote(차트+요약)와 이중 quoteSummary 호출 제거 */
  const modules =
    'incomeStatementHistoryQuarterly,incomeStatementHistory,summaryDetail,defaultKeyStatistics,price';
  const path = `/v10/finance/quoteSummary/${encodeURIComponent(normalizedSymbol)}?modules=${modules}`;

  const tsPromise = fetchYahooFundamentalsTimeseriesMaps(normalizedSymbol);

  try {
    yahooFsTrace('fetch_start', { symbol: normalizedSymbol, modules, hosts: [...YAHOO_QUERY_HOSTS] });
    let session = await yahooGetCrumbSession(normalizedSymbol);
    yahooFsTrace('fetch_crumb_session', {
      symbol: normalizedSymbol,
      hasCrumb: session?.crumb != null,
      hasCookie: session?.cookie != null && session.cookie.length > 0,
    });
    for (const host of YAHOO_QUERY_HOSTS) {
      const pathWithCrumb = appendYahooCrumbQuery(path, session?.crumb ?? null);
      const url = `https://${host}${pathWithCrumb}`;
      try {
        let res = await fetch(url, {
          headers: yahooRequestHeadersWithCookie(normalizedSymbol, session?.cookie),
        });
        if (res.status === 401) {
          invalidateYahooCrumbSession();
          session = await yahooGetCrumbSession(normalizedSymbol);
          yahooFsTrace('fetch_401_retry_crumb', { symbol: normalizedSymbol, host });
          const url2 = `https://${host}${appendYahooCrumbQuery(path, session?.crumb ?? null)}`;
          res = await fetch(url2, {
            headers: yahooRequestHeadersWithCookie(normalizedSymbol, session?.cookie),
          });
        }
        if (!res.ok) {
          yahooFsTrace('fetch_http_error', { symbol: normalizedSymbol, host, status: res.status });
          continue;
        }
        const data = (await res.json()) as {
          quoteSummary?: { result?: Record<string, unknown>[]; error?: unknown };
          finance?: { result?: Record<string, unknown>[]; error?: unknown };
        };
        const envErr = data.quoteSummary?.error ?? data.finance?.error;
        if (envErr != null) {
          yahooFsTrace('fetch_envelope_error', { symbol: normalizedSymbol, host, error: envErr });
        }
        const r0 = extractYahooQuoteSummaryResult0(data);
        if (!r0) {
          yahooFsTrace('fetch_empty_r0', {
            symbol: normalizedSymbol,
            host,
            hasQuoteSummary: data.quoteSummary != null,
            hasFinance: data.finance != null,
          });
          continue;
        }
        yahooFsTrace('fetch_ok', { symbol: normalizedSymbol, host, status: res.status });
        const capMeta = extractQuoteSummaryCapMeta(r0);
        const stmtCurrency = resolveStatementCurrencyFromQuote(normalizedSymbol, r0);
        const krwPerStmt = await resolveKrwPerStatementUnit(stmtCurrency, usdKrwRate);
        yahooFsTrace('fetch_stmt_currency', {
          symbol: normalizedSymbol,
          stmtCurrency,
          krwPerStmt,
          usdKrwForRef: usdKrwRate,
        });
        const parsed = parseIncomeHistoryModules(r0, krwPerStmt, normalizedSymbol);
        const tsMaps = await tsPromise;
        mergeFundamentalsTimeseriesIntoParsed(parsed, tsMaps, krwPerStmt, normalizedSymbol);
        return {
          parsed,
          marketCap: capMeta.marketCap,
          currency: capMeta.currency,
        };
      } catch (inner: unknown) {
        yahooFsTrace('fetch_host_exception', {
          symbol: normalizedSymbol,
          host,
          message: inner instanceof Error ? inner.message : String(inner),
        });
      }
    }
    yahooFsTrace('fetch_all_hosts_failed', { symbol: normalizedSymbol });
    await tsPromise;
    return { parsed: null };
  } catch (e: unknown) {
    yahooFsTrace('fetch_exception', {
      symbol: normalizedSymbol,
      message: e instanceof Error ? e.message : String(e),
    });
    await tsPromise;
    return { parsed: null };
  }
}

/**
 * 한 종목(해외 mockKey = 대문자 티커)에 대해, 표에 필요한 기간 열만 채운 단일 열 그리드 조각을 만듭니다.
 */
export async function buildYahooFundamentalsGridColumn(params: {
  yahooSymbol: string;
  mockKey: string;
  periodKeys: string[];
  granularity: 'year' | 'quarter';
  usdKrwRate: number;
}): Promise<{
  grid: DartFundamentalsGrid;
  mockKey: string;
  marketCap?: number;
  currency?: string;
}> {
  const { yahooSymbol, mockKey, periodKeys, granularity, usdKrwRate } = params;
  const fetchResult = await fetchYahooIncomeStatementModules(yahooSymbol, usdKrwRate);
  const parsed = fetchResult.parsed;
  const grid: DartFundamentalsGrid = {};

  const empty = (): DartCellBundle => ({
    revenueKr: '—',
    operatingIncomeKr: '—',
    marketCapKr: '—',
    per: '—',
    netIncomeWon: null,
    operatingIncomeWon: null,
  });

  if (!parsed) {
    for (const pk of periodKeys) {
      grid[pk] = { [mockKey]: empty() };
    }
    return { grid, mockKey, marketCap: fetchResult.marketCap, currency: fetchResult.currency };
  }

  const src = granularity === 'year' ? parsed.annualByYear : parsed.quarterlyByPeriod;

  for (const pk of periodKeys) {
    grid[pk] = {};
    const b = src.get(pk);
    grid[pk][mockKey] = b ?? empty();
  }

  return {
    grid,
    mockKey,
    marketCap: fetchResult.marketCap,
    currency: fetchResult.currency,
  };
}
