import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect, usePathname, useGlobalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAllAccounts, getStocksByAccountId, initDatabase } from '../src/services/DatabaseService';
import { openDefaultPortfolioAddStock } from '../src/navigation/openDefaultPortfolioAddStock';
import type { Stock } from '../src/models/Stock';
import {
  MOCK_FX_DISCLOSURE,
  METRIC_TAB_LABELS,
  buildQuarterPeriodRowsForYear,
  buildYearPeriodRowsForChoices,
  fundamentalsDefaultPreviousCalendarYear,
  fundamentalsDefaultQuarterWithinChoices,
  fundamentalsMockKey,
  fundamentalsPickYearPeriodKeyForTarget,
  fundamentalsQuarterYearChoices,
  getMockCell,
  type FundamentalsMetricTab,
  type MockFundamentalsPeriodRow,
} from '../src/data/fundamentalsCompareMock';

function initFundamentalsPeriodState(): { periodKey: string; quarterYear: number } {
  const d = new Date();
  const yChoices = fundamentalsQuarterYearChoices(d, 3);
  const yearRows = buildYearPeriodRowsForChoices(yChoices);
  const yearKey = fundamentalsPickYearPeriodKeyForTarget(
    fundamentalsDefaultPreviousCalendarYear(d),
    yearRows
  );
  const qInit = fundamentalsDefaultQuarterWithinChoices(d, yChoices);
  return { periodKey: yearKey, quarterYear: qInit.quarterYear };
}

interface DedupedStockRow {
  mockKey: string;
  displayTicker: string;
  label: string;
}

export default function FundamentalsCompareScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const globalParams = useGlobalSearchParams<{ id?: string | string[] }>();
  const routePortfolioId = Array.isArray(globalParams.id) ? globalParams.id[0] : globalParams.id;
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [deduped, setDeduped] = useState<DedupedStockRow[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [granularity, setGranularity] = useState<'year' | 'quarter'>('year');
  const initPeriod = useMemo(() => initFundamentalsPeriodState(), []);
  const [periodKey, setPeriodKey] = useState<string>(() => initPeriod.periodKey);
  /** 분기 모드에서 선택한 달력 연도(목·실데이터 모두 종목 회계분기로 채울 때는 API와 맞춤) */
  const [quarterYear, setQuarterYear] = useState<number>(() => initPeriod.quarterYear);
  const [metricTab, setMetricTab] = useState<FundamentalsMetricTab>('revenue');

  const quarterYearChoices = useMemo(() => fundamentalsQuarterYearChoices(new Date(), 3), []);

  const yearPeriodRows = useMemo(
    () => buildYearPeriodRowsForChoices(quarterYearChoices),
    [quarterYearChoices]
  );

  const periodRows: MockFundamentalsPeriodRow[] = useMemo(
    () => (granularity === 'year' ? yearPeriodRows : buildQuarterPeriodRowsForYear(quarterYear)),
    [granularity, quarterYear, yearPeriodRows]
  );

  const currentRow = useMemo(
    () => periodRows.find((r) => r.periodKey === periodKey) ?? periodRows[periodRows.length - 1],
    [periodRows, periodKey]
  );

  const loadPortfolioStocks = useCallback(async () => {
    setLoading(true);
    try {
      await initDatabase();
      const accounts = await getAllAccounts();
      const byKey = new Map<string, DedupedStockRow>();
      for (const acc of accounts) {
        const stocks: Stock[] = await getStocksByAccountId(acc.id);
        for (const s of stocks) {
          const mockKey = fundamentalsMockKey(s.ticker);
          if (!byKey.has(mockKey)) {
            const label = (s.name || s.officialName || s.ticker).trim() || s.ticker;
            byKey.set(mockKey, {
              mockKey,
              displayTicker: s.ticker,
              label,
            });
          }
        }
      }
      const list = Array.from(byKey.values());
      setDeduped(list);
      setSelectedKeys(new Set(list.map((x) => x.mockKey)));
    } catch (e) {
      console.error('[FundamentalsCompare] 포트폴리오 종목 로드 실패:', e);
      setDeduped([]);
      setSelectedKeys(new Set());
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadPortfolioStocks();
    }, [loadPortfolioStocks])
  );

  const handleAddStock = useCallback(() => {
    openDefaultPortfolioAddStock(router, {
      pathname,
      currentPortfolioId: routePortfolioId != null ? String(routePortfolioId) : null,
    });
  }, [router, pathname, routePortfolioId]);

  useEffect(() => {
    if (granularity === 'year') {
      const rows = buildYearPeriodRowsForChoices(quarterYearChoices);
      const last = rows[rows.length - 1];
      const fromQuarter = /^(\d{4})Q[1-4]$/.exec(periodKey);
      if (fromQuarter) {
        const y = fromQuarter[1];
        if (rows.some((r) => r.periodKey === y)) {
          setPeriodKey(y);
          return;
        }
      }
      if (last && !rows.some((r) => r.periodKey === periodKey)) {
        setPeriodKey(
          fundamentalsPickYearPeriodKeyForTarget(
            fundamentalsDefaultPreviousCalendarYear(new Date()),
            rows
          )
        );
      }
      return;
    }

    if (/^\d{4}$/.test(periodKey)) {
      const d = new Date();
      const { quarterYear: qy, periodKey: pk } = fundamentalsDefaultQuarterWithinChoices(
        d,
        quarterYearChoices
      );
      setQuarterYear(qy);
      setPeriodKey(pk);
      return;
    }

    const qm = /^(\d{4})Q([1-4])$/.exec(periodKey);
    if (qm) {
      const py = Number(qm[1]);
      if (py !== quarterYear) {
        if (quarterYearChoices.includes(py)) {
          setQuarterYear(py);
        } else {
          const y0 = quarterYearChoices[0] ?? py;
          setQuarterYear(y0);
          setPeriodKey(`${y0}Q${qm[2]}`);
        }
      }
      return;
    }

    const rows = buildQuarterPeriodRowsForYear(quarterYear);
    const last = rows[rows.length - 1];
    if (last && !rows.some((r) => r.periodKey === periodKey)) {
      setPeriodKey(last.periodKey);
    }
  }, [granularity, periodKey, quarterYear, quarterYearChoices]);

  const setQuarterYearAndKeepQuarter = useCallback(
    (y: number) => {
      setQuarterYear(y);
      setPeriodKey((prev) => {
        const m = /^(\d{4})Q([1-4])$/.exec(prev);
        if (m) return `${y}Q${m[2]}`;
        return `${y}Q4`;
      });
    },
    []
  );

  const selectedRows = useMemo(
    () => deduped.filter((r) => selectedKeys.has(r.mockKey)),
    [deduped, selectedKeys]
  );

  const toggleKey = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size <= 1) return next;
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#000000', '#121212', '#1A1A1A']} style={StyleSheet.absoluteFill} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.banner, { marginTop: insets.top + 8 }]}>
          <Text style={styles.bannerTitle}>샘플 데이터</Text>
          <Text style={styles.bannerSub}>
            숫자는 데모용 하드코딩입니다. API 연동 후 동일 UI에 실데이터를 채웁니다.
          </Text>
        </View>

        <Text style={styles.fxLine}>{MOCK_FX_DISCLOSURE}</Text>

        <Text style={styles.sectionTitle}>기간 단위</Text>
        <View style={styles.chipRow}>
          <TouchableOpacity
            style={[styles.chip, granularity === 'year' && styles.chipOn]}
            onPress={() => {
              if (granularity === 'year') return;
              setGranularity('year');
            }}
            activeOpacity={0.85}
          >
            <Text style={[styles.chipText, granularity === 'year' && styles.chipTextOn]}>연도</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chip, granularity === 'quarter' && styles.chipOn]}
            onPress={() => {
              if (granularity === 'quarter') return;
              const d = new Date();
              const choices = fundamentalsQuarterYearChoices(d, 3);
              const next = fundamentalsDefaultQuarterWithinChoices(d, choices);
              setGranularity('quarter');
              setQuarterYear(next.quarterYear);
              setPeriodKey(next.periodKey);
            }}
            activeOpacity={0.85}
          >
            <Text style={[styles.chipText, granularity === 'quarter' && styles.chipTextOn]}>분기</Text>
          </TouchableOpacity>
        </View>

        {granularity === 'quarter' ? (
          <>
            <Text style={styles.sectionTitle}>분기 연도</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.periodScroll}
            >
              {quarterYearChoices.map((y) => (
                <TouchableOpacity
                  key={y}
                  style={[styles.periodChip, quarterYear === y && styles.periodChipOn]}
                  onPress={() => setQuarterYearAndKeepQuarter(y)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.periodChipText, quarterYear === y && styles.periodChipTextOn]}>
                    {y}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={styles.sectionTitle}>분기 선택</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.periodScroll}
            >
              {([1, 2, 3, 4] as const).map((q) => {
                const pk = `${quarterYear}Q${q}`;
                const on = periodKey === pk;
                return (
                  <TouchableOpacity
                    key={pk}
                    style={[styles.periodChip, on && styles.periodChipOn]}
                    onPress={() => setPeriodKey(pk)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.periodChipText, on && styles.periodChipTextOn]}>{`Q${q}`}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </>
        ) : (
          <>
            <Text style={styles.sectionTitle}>기간 선택</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.periodScroll}>
              {periodRows.map((r) => (
                <TouchableOpacity
                  key={r.periodKey}
                  style={[styles.periodChip, periodKey === r.periodKey && styles.periodChipOn]}
                  onPress={() => setPeriodKey(r.periodKey)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.periodChipText, periodKey === r.periodKey && styles.periodChipTextOn]}>
                    {r.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        <Text style={styles.sectionTitle}>지표</Text>
        <View style={styles.metricTabs}>
          {(Object.keys(METRIC_TAB_LABELS) as FundamentalsMetricTab[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.metricTab, metricTab === tab && styles.metricTabOn]}
              onPress={() => setMetricTab(tab)}
              activeOpacity={0.85}
            >
              <Text style={[styles.metricTabText, metricTab === tab && styles.metricTabTextOn]}>
                {METRIC_TAB_LABELS[tab]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, styles.sectionTitleInline]}>
            비교 종목 (전 포트폴리오 합집합 · 중복 제거)
          </Text>
          <TouchableOpacity style={styles.addStockBtn} onPress={handleAddStock} activeOpacity={0.85}>
            <Text style={styles.addStockBtnText}>+ 종목 추가</Text>
          </TouchableOpacity>
        </View>
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color="#42A5F5" />
            <Text style={styles.loadingText}>종목 불러오는 중…</Text>
          </View>
        ) : deduped.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>등록된 종목이 없습니다</Text>
            <Text style={styles.emptySub}>포트폴리오에 종목을 추가하면 여기에 표시됩니다.</Text>
            <TouchableOpacity style={styles.addStockBtnLarge} onPress={handleAddStock} activeOpacity={0.85}>
              <Text style={styles.addStockBtnLargeText}>종목 추가하러 가기</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.checkList}>
            {deduped.map((row) => {
              const on = selectedKeys.has(row.mockKey);
              return (
                <Pressable
                  key={row.mockKey}
                  style={({ pressed }) => [styles.checkRow, pressed && { opacity: 0.85 }]}
                  onPress={() => toggleKey(row.mockKey)}
                >
                  <View style={[styles.checkbox, on && styles.checkboxOn]}>
                    {on ? <Text style={styles.checkMark}>✓</Text> : null}
                  </View>
                  <View style={styles.checkTextCol}>
                    <Text style={styles.checkLabel} numberOfLines={1}>
                      {row.label}
                    </Text>
                    <Text style={styles.checkTicker} numberOfLines={1}>
                      {row.displayTicker}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        {!loading && deduped.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>
              {METRIC_TAB_LABELS[metricTab]} · {currentRow.label}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator style={styles.tableScroll}>
              <View style={styles.tableInner}>
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.th, styles.thPeriod]}>기간</Text>
                  {selectedRows.map((s) => (
                    <Text key={s.mockKey} style={[styles.th, styles.thStock]} numberOfLines={2}>
                      {s.label}
                    </Text>
                  ))}
                </View>
                {periodRows.map((r) => (
                  <View
                    key={r.periodKey}
                    style={[styles.tableBodyRow, r.periodKey === periodKey && styles.tableBodyRowHighlight]}
                  >
                    <Text style={[styles.td, styles.thPeriod]}>{r.label}</Text>
                    {selectedRows.map((s) => (
                      <Text key={`${r.periodKey}-${s.mockKey}`} style={[styles.td, styles.thStock]}>
                        {getMockCell(metricTab, r, s.mockKey)}
                      </Text>
                    ))}
                  </View>
                ))}
              </View>
            </ScrollView>
            <Text style={styles.tableHint}>
              가로로 스크롤하여 열을 확인할 수 있습니다. 분기는 달력 연·분기 라벨이며, 실데이터에서는 종목별 회계 분기에 맞춰 채웁니다. 샘플 숫자는 일부 티커·연도에만 있습니다.
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#121212',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  banner: {
    backgroundColor: 'rgba(66, 165, 245, 0.12)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(66, 165, 245, 0.25)',
  },
  bannerTitle: {
    color: '#90CAF9',
    fontWeight: '700',
    fontSize: 14,
    marginBottom: 4,
  },
  bannerSub: {
    color: '#B0BEC5',
    fontSize: 12,
    lineHeight: 18,
  },
  fxLine: {
    marginTop: 14,
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
  },
  sectionTitle: {
    marginTop: 20,
    marginBottom: 10,
    color: '#ECEFF1',
    fontSize: 15,
    fontWeight: '700',
  },
  sectionHeaderRow: {
    marginTop: 20,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  sectionTitleInline: {
    flex: 1,
    marginTop: 0,
    marginBottom: 0,
    marginRight: 4,
  },
  addStockBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(66, 165, 245, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(66, 165, 245, 0.45)',
  },
  addStockBtnText: {
    color: '#90CAF9',
    fontWeight: '700',
    fontSize: 13,
  },
  addStockBtnLarge: {
    marginTop: 16,
    alignSelf: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: 'rgba(66, 165, 245, 0.28)',
    borderWidth: 1,
    borderColor: 'rgba(66, 165, 245, 0.5)',
  },
  addStockBtnLargeText: {
    color: '#E3F2FD',
    fontWeight: '700',
    fontSize: 15,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 10,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  chipOn: {
    backgroundColor: 'rgba(66, 165, 245, 0.25)',
    borderColor: 'rgba(66, 165, 245, 0.5)',
  },
  chipText: {
    color: '#B0BEC5',
    fontWeight: '600',
    fontSize: 14,
  },
  chipTextOn: {
    color: '#FFFFFF',
  },
  periodScroll: {
    gap: 8,
    paddingRight: 8,
  },
  periodChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginRight: 8,
  },
  periodChipOn: {
    backgroundColor: 'rgba(66, 165, 245, 0.3)',
  },
  periodChipText: {
    color: '#B0BEC5',
    fontSize: 13,
    fontWeight: '600',
  },
  periodChipTextOn: {
    color: '#FFFFFF',
  },
  metricTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricTab: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  metricTabOn: {
    backgroundColor: 'rgba(76, 175, 80, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.45)',
  },
  metricTabText: {
    color: '#CFD8DC',
    fontSize: 13,
    fontWeight: '600',
  },
  metricTabTextOn: {
    color: '#FFFFFF',
  },
  loadingBox: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    color: '#90A4AE',
    fontSize: 13,
  },
  emptyBox: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  emptyTitle: {
    color: '#ECEFF1',
    fontWeight: '700',
    fontSize: 15,
    marginBottom: 6,
  },
  emptySub: {
    color: '#90A4AE',
    fontSize: 13,
    lineHeight: 20,
  },
  checkList: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: '#42A5F5',
    borderColor: '#42A5F5',
  },
  checkMark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  checkTextCol: {
    flex: 1,
    minWidth: 0,
  },
  checkLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  checkTicker: {
    color: '#90A4AE',
    fontSize: 12,
    marginTop: 2,
  },
  tableScroll: {
    marginTop: 4,
    maxHeight: 320,
  },
  tableInner: {
    alignSelf: 'flex-start',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(66, 165, 245, 0.35)',
    paddingBottom: 8,
    marginBottom: 4,
  },
  tableBodyRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  tableBodyRowHighlight: {
    backgroundColor: 'rgba(66, 165, 245, 0.08)',
  },
  th: {
    color: '#90CAF9',
    fontWeight: '700',
    fontSize: 12,
    textAlign: 'center',
  },
  td: {
    color: '#ECEFF1',
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '500',
  },
  thPeriod: {
    width: 72,
    textAlign: 'left',
    paddingRight: 8,
  },
  thStock: {
    width: 100,
    paddingHorizontal: 6,
  },
  tableHint: {
    marginTop: 8,
    color: '#78909C',
    fontSize: 11,
    lineHeight: 16,
  },
});
