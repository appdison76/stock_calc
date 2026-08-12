import type { DartCellBundle } from './dartFundamentalsGrid';
import { formatWonShortKr } from './dartFormatKr';

/** 연율 손익 ÷ 시총이 이 배수를 넘으면 DART 천원 스케일 과대(×1000 중복)로 보고 ÷1000 보정 */
export const REV_ANNUALIZED_OVER_CAP_SUSPICIOUS = 10;

function annualizeForCapSuspicion(baseWon: number | null, g: 'year' | 'quarter'): number | null {
  if (baseWon == null || !Number.isFinite(baseWon)) return null;
  if (g === 'year') return baseWon;
  return baseWon * 4;
}

/**
 * 네이버 시총 대비 연율 손익이 비정형이면 DART 천원 스케일 과대 의심.
 * 매출 우선, 없으면 영업이익(>0)·당기순(|·|).
 */
export function domesticDartIncomeToCapSuspicious(
  capWon: number | null,
  revenueWon: number | null,
  operatingIncomeWon: number | null,
  netIncomeWon: number | null,
  granularity: 'year' | 'quarter'
): boolean {
  if (capWon == null || !Number.isFinite(capWon) || capWon <= 0) return false;
  const thresh = capWon * REV_ANNUALIZED_OVER_CAP_SUSPICIOUS;

  if (revenueWon != null && Number.isFinite(revenueWon) && revenueWon > 0) {
    const a = annualizeForCapSuspicion(revenueWon, granularity);
    if (a != null && Number.isFinite(a) && a > thresh) return true;
  }
  if (operatingIncomeWon != null && Number.isFinite(operatingIncomeWon) && operatingIncomeWon > 0) {
    const a = annualizeForCapSuspicion(operatingIncomeWon, granularity);
    if (a != null && Number.isFinite(a) && a > thresh) return true;
  }
  if (netIncomeWon != null && Number.isFinite(netIncomeWon) && netIncomeWon !== 0) {
    const a = annualizeForCapSuspicion(Math.abs(netIncomeWon), granularity);
    if (a != null && Number.isFinite(a) && a > thresh) return true;
  }
  return false;
}

/** 국내 6자리 + 시총·손익 기준. 1 또는 1e-3 */
export function dartDomesticWonScaleDown(
  mockKey: string | null | undefined,
  capWon: number | null,
  revenueWon: number | null,
  operatingIncomeWon: number | null,
  netIncomeWon: number | null,
  granularity: 'year' | 'quarter'
): number {
  if (mockKey == null || !/^\d{6}$/.test(String(mockKey).trim())) return 1;
  if (
    !domesticDartIncomeToCapSuspicious(
      capWon,
      revenueWon,
      operatingIncomeWon,
      netIncomeWon,
      granularity
    )
  ) {
    return 1;
  }
  return 1e-3;
}

export function dartDomesticWonScaleForBundle(
  mockKey: string,
  capWon: number | null,
  bundle: DartCellBundle | undefined,
  granularity: 'year' | 'quarter'
): number {
  if (!bundle) return 1;
  return dartDomesticWonScaleDown(
    mockKey,
    capWon,
    bundle.revenueWon ?? null,
    bundle.operatingIncomeWon ?? null,
    bundle.netIncomeWon ?? null,
    granularity
  );
}

/** `scale`이 1e-3일 때 매출·영업·순이익 표시용 문자열·won 동기 보정 */
export function applyDartDomesticCapScaleToBundle(
  bundle: DartCellBundle | undefined,
  scale: number
): DartCellBundle | undefined {
  if (!bundle || scale >= 1) return bundle;
  const rev = bundle.revenueWon;
  const op = bundle.operatingIncomeWon;
  const net = bundle.netIncomeWon;
  const revW = rev != null && Number.isFinite(rev) ? rev * scale : null;
  const opW = op != null && Number.isFinite(op) ? op * scale : null;
  const netW = net != null && Number.isFinite(net) ? net * scale : null;
  const eq = bundle.equityWon;
  const eqW = eq != null && Number.isFinite(eq) ? eq * scale : null;
  return {
    ...bundle,
    revenueKr: revW != null ? formatWonShortKr(revW) : bundle.revenueKr,
    revenueWon: revW ?? bundle.revenueWon,
    operatingIncomeKr: opW != null ? formatWonShortKr(opW) : bundle.operatingIncomeKr,
    operatingIncomeWon: opW ?? bundle.operatingIncomeWon,
    netIncomeWon: netW ?? bundle.netIncomeWon,
    equityWon: eqW ?? bundle.equityWon,
    equityKr: eqW != null ? formatWonShortKr(eqW) : bundle.equityKr,
  };
}
