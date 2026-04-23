/** 하루 정산: 요약(총액만) 또는 상세(줄 합계) — 동시에 사용하지 않음 */
export type DailySettlementMode = 'summary' | 'detail';

export interface DailySettlementLine {
  id?: number;
  settlementId?: number;
  sortOrder: number;
  /** 원 단위, 음수 허용 */
  amount: number;
  memo: string;
}

export interface DailySettlement {
  id: number;
  date: string;
  mode: DailySettlementMode;
  /** 요약 모드일 때만 */
  summaryAmount: number | null;
  dailyMemo: string;
  updatedAt: number;
  lines?: DailySettlementLine[];
}

/** 목록 한 행 표시용 */
export interface DailySettlementListItem {
  date: string;
  total: number;
  mode: DailySettlementMode;
  memoPreview: string;
}

export type PeriodTab = 'month' | 'year' | 'all';

/** 일일 정산 목록 화면 탭 (메인 카드에는 month/year/all만 사용) */
export type DailySettlementListTab = PeriodTab | 'range';

/** JSON 백업/복원용 (schemaVersion 1) */
export const DAILY_SETTLEMENT_BACKUP_KIND = 'daily_settlement_backup' as const;
export const DAILY_SETTLEMENT_BACKUP_SCHEMA_VERSION = 1;

export interface DailySettlementBackupDay {
  date: string;
  mode: DailySettlementMode;
  summaryAmount: number | null;
  dailyMemo: string;
  lines: { amount: number; memo: string }[];
}

export interface DailySettlementBackupPayload {
  schemaVersion: number;
  kind: typeof DAILY_SETTLEMENT_BACKUP_KIND;
  exportedAt: string;
  settlements: DailySettlementBackupDay[];
}
