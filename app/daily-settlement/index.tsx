import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Modal,
  Alert,
  Platform,
  TextInput,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { initDatabase } from '../../src/services/DatabaseService';
import type { DailySettlementListTab } from '../../src/models/DailySettlement';
import type { DailySettlementListItem } from '../../src/models/DailySettlement';
import {
  exportDailySettlementBackupJson,
  formatDateKey,
  getYearsWithData,
  lastMonthRange,
  listForDateRangeWithMemoFilter,
  listForPeriod,
  parseDailySettlementBackupJson,
  replaceAllDailySettlementsFromBackup,
  sumForPeriod,
  sumForRangeWithMemoFilter,
  todayDateRange,
} from '../../src/services/DailySettlementService';
import type { DailySettlementBackupPayload } from '../../src/models/DailySettlement';
import { addCommas } from '../../src/utils/formatUtils';

function formatSignedKrw(n: number): string {
  const abs = addCommas(Math.abs(Math.round(n)).toString());
  if (n > 0) return `+${abs}원`;
  if (n < 0) return `-${abs}원`;
  return `${abs}원`;
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-');
  return `${y}년 ${parseInt(m, 10)}월`;
}

function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map((x) => parseInt(x, 10));
  return new Date(y, (m || 1) - 1, d || 1);
}

function initialRangeDates(): { start: string; end: string } {
  const now = new Date();
  return {
    start: formatDateKey(new Date(now.getFullYear(), now.getMonth(), 1)),
    end: formatDateKey(now),
  };
}

const LIST_TABS: { key: DailySettlementListTab; label: string }[] = [
  { key: 'month', label: '이번 달' },
  { key: 'year', label: '올해' },
  { key: 'all', label: '전체' },
  { key: 'range', label: '기간' },
];

export default function DailySettlementListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [backupModalVisible, setBackupModalVisible] = useState(false);
  const [listTab, setListTab] = useState<DailySettlementListTab>('month');
  const initRangeRef = React.useMemo(() => initialRangeDates(), []);
  const [rangeStart, setRangeStart] = useState(initRangeRef.start);
  const [rangeEnd, setRangeEnd] = useState(initRangeRef.end);
  /** 기간 탭: 줄 메모·일별 메모 부분 검색(비우면 전체 합계) */
  const [rangeMemoQuery, setRangeMemoQuery] = useState('');
  const rangePickerTargetRef = useRef<'start' | 'end' | null>(null);
  const [pickerDate, setPickerDate] = useState(() => new Date());
  const [showIosRangePicker, setShowIosRangePicker] = useState(false);
  const [showAndroidRangePicker, setShowAndroidRangePicker] = useState(false);
  const [filterYear, setFilterYear] = useState<number>(new Date().getFullYear());
  const [years, setYears] = useState<number[]>([]);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<DailySettlementListItem[]>([]);
  const [loading, setLoading] = useState(true);
  /** 월 키(YYYY-MM)가 Set에 있으면 해당 월 섹션이 접힘 */
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());

  const load = useCallback(
    async (opts?: { range?: { start: string; end: string } }) => {
      setLoading(true);
      try {
        await initDatabase();
        const ys = await getYearsWithData();
        setYears(ys);

        if (listTab === 'range') {
          let s = opts?.range?.start ?? rangeStart;
          let e = opts?.range?.end ?? rangeEnd;
          if (s > e) [s, e] = [e, s];
          const sum = await sumForRangeWithMemoFilter(s, e, rangeMemoQuery);
          const list = await listForDateRangeWithMemoFilter(s, e, rangeMemoQuery);
          setTotal(sum);
          setItems(list);
          return;
        }

        let effectiveYear = filterYear;
        if (listTab === 'all') {
          if (ys.length > 0 && !ys.includes(filterYear)) {
            effectiveYear = ys[0];
            setFilterYear(effectiveYear);
          }
        }
        const sum = await sumForPeriod(
          listTab,
          listTab === 'all' ? effectiveYear : undefined
        );
        const list = await listForPeriod(
          listTab,
          listTab === 'all' ? effectiveYear : undefined
        );
        setTotal(sum);
        setItems(list);
      } catch (e) {
        console.error('일일 정산 목록 로드 오류:', e);
      } finally {
        setLoading(false);
      }
    },
    [listTab, filterYear, rangeStart, rangeEnd, rangeMemoQuery]
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const groupedByMonth = useMemo(() => {
    const map = new Map<string, DailySettlementListItem[]>();
    for (const it of items) {
      const key = it.date.slice(0, 7);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    }
    const keys = [...map.keys()].sort((a, b) => b.localeCompare(a));
    return keys.map((k) => ({ monthKey: k, rows: map.get(k)! }));
  }, [items]);

  const toggleMonth = (monthKey: string) => {
    setCollapsedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(monthKey)) next.delete(monthKey);
      else next.add(monthKey);
      return next;
    });
  };

  const onChangeTab = (t: DailySettlementListTab) => {
    setListTab(t);
    setCollapsedMonths(new Set());
    if (t === 'range') {
      const { start, end } = initialRangeDates();
      setRangeStart(start);
      setRangeEnd(end);
    }
  };

  const openRangePicker = (target: 'start' | 'end') => {
    rangePickerTargetRef.current = target;
    const key = target === 'start' ? rangeStart : rangeEnd;
    setPickerDate(parseDateKey(key));
    if (Platform.OS === 'ios') {
      setShowIosRangePicker(true);
    } else {
      setShowAndroidRangePicker(true);
    }
  };

  const onPickRangeDateAndroid = (event: { type?: string }, selected?: Date) => {
    setShowAndroidRangePicker(false);
    if (Platform.OS === 'android' && event.type === 'dismissed') {
      rangePickerTargetRef.current = null;
      return;
    }
    const target = rangePickerTargetRef.current;
    rangePickerTargetRef.current = null;
    if (!selected || !target) return;
    const k = formatDateKey(selected);
    if (target === 'start') setRangeStart(k);
    else setRangeEnd(k);
  };

  const confirmRangeIos = () => {
    const target = rangePickerTargetRef.current;
    if (!target) return;
    const k = formatDateKey(pickerDate);
    if (target === 'start') setRangeStart(k);
    else setRangeEnd(k);
    rangePickerTargetRef.current = null;
    setShowIosRangePicker(false);
  };

  const flatListMode = listTab === 'month' || listTab === 'range';

  const totalColor = total >= 0 ? styles.amtPos : styles.amtNeg;

  const runBackup = async () => {
    try {
      await initDatabase();
      const json = await exportDailySettlementBackupJson();
      const dir = FileSystem.cacheDirectory;
      if (!dir) {
        Alert.alert('오류', '파일을 저장할 경로가 없습니다.');
        return;
      }
      const fileName = `daily_settlement_backup_${formatDateKey(new Date())}.json`;
      const path = `${dir}${fileName}`;
      await FileSystem.writeAsStringAsync(path, json, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      const avail = await Sharing.isAvailableAsync();
      if (!avail) {
        Alert.alert('공유 불가', '이 기기에서는 파일 공유를 할 수 없습니다.');
        return;
      }
      await Sharing.shareAsync(path, {
        mimeType: 'application/json',
        dialogTitle: '일일 정산 백업 저장',
      });
    } catch (e) {
      console.error('일일 정산 백업 오류:', e);
      Alert.alert('백업 실패', e instanceof Error ? e.message : '알 수 없는 오류입니다.');
    }
  };

  const pickAndRestore = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const uri = result.assets[0].uri;
      let text: string;
      try {
        text = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.UTF8,
        });
      } catch (readErr) {
        console.error(readErr);
        Alert.alert('오류', '파일을 읽지 못했습니다.');
        return;
      }

      let payload: DailySettlementBackupPayload;
      try {
        payload = parseDailySettlementBackupJson(text);
      } catch (err) {
        Alert.alert(
          '백업 파일 오류',
          err instanceof Error ? err.message : String(err)
        );
        return;
      }

      Alert.alert(
        '복원',
        '이 기기의 일일 정산 전부가 선택한 파일 내용으로 바뀝니다. 진행할까요?',
        [
          { text: '취소', style: 'cancel' },
          {
            text: '복원',
            style: 'destructive',
            onPress: async () => {
              try {
                await initDatabase();
                await replaceAllDailySettlementsFromBackup(payload);
                setBackupModalVisible(false);
                await load();
                Alert.alert('복원 완료', '일일 정산이 백업 파일대로 반영되었습니다.');
              } catch (re) {
                console.error(re);
                Alert.alert(
                  '복원 실패',
                  re instanceof Error ? re.message : '알 수 없는 오류입니다.'
                );
              }
            },
          },
        ]
      );
    } catch (e) {
      console.error(e);
      Alert.alert('오류', '파일을 선택하지 못했습니다.');
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: '일일 정산',
          headerRight: () => (
            <TouchableOpacity
              onPress={() => router.push('/daily-settlement/edit' as any)}
              style={styles.headerBtn}
              activeOpacity={0.7}
            >
              <Text style={styles.headerBtnText}>추가</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <View style={[styles.root, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Text style={styles.subtitle}>금액·메모·일별 요약</Text>

        <View style={styles.tabBarRow}>
          <View style={styles.tabChipsWrap}>
            {LIST_TABS.map(({ key: t, label }) => {
              const active = listTab === t;
              return (
                <TouchableOpacity
                  key={t}
                  style={[styles.tabChip, active && styles.tabChipActive]}
                  onPress={() => onChangeTab(t)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.tabChipText, active && styles.tabChipTextActive]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity
            style={styles.tabGearBtn}
            onPress={() => setBackupModalVisible(true)}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="데이터 백업 및 복원"
          >
            <Text style={styles.tabGearIcon}>{'\u2699'}</Text>
          </TouchableOpacity>
        </View>

        {listTab === 'range' ? (
          <View style={styles.rangePanel}>
            <View style={styles.rangeDatesRow}>
              <TouchableOpacity
                style={styles.rangeDateChip}
                onPress={() => openRangePicker('start')}
                activeOpacity={0.8}
              >
                <Text style={styles.rangeDateVal}>{rangeStart}</Text>
              </TouchableOpacity>
              <Text style={styles.rangeSep}>~</Text>
              <TouchableOpacity
                style={styles.rangeDateChip}
                onPress={() => openRangePicker('end')}
                activeOpacity={0.8}
              >
                <Text style={styles.rangeDateVal}>{rangeEnd}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.rangeQuickRow}>
              <TouchableOpacity
                style={styles.rangeQuickChip}
                onPress={() => {
                  const r = todayDateRange();
                  setRangeStart(r.start);
                  setRangeEnd(r.end);
                  void load({ range: r });
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.rangeQuickChipText}>오늘</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.rangeQuickChip}
                onPress={() => {
                  const r = lastMonthRange();
                  setRangeStart(r.start);
                  setRangeEnd(r.end);
                  void load({ range: r });
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.rangeQuickChipText}>지난달</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.rangeMemoInput}
              value={rangeMemoQuery}
              onChangeText={setRangeMemoQuery}
              placeholder="메모 포함 검색 (상세=줄 메모, 요약=일별 메모)"
              placeholderTextColor="#666"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={() => void load()}
            />
            <TouchableOpacity style={styles.rangeApplyBtn} onPress={() => void load()} activeOpacity={0.85}>
              <Text style={styles.rangeApplyText}>조회</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {listTab === 'all' && years.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.yearScroll}
            contentContainerStyle={styles.yearScrollInner}
          >
            {years.map((y) => {
              const sel = y === filterYear;
              return (
                <TouchableOpacity
                  key={y}
                  style={[styles.yearChip, sel && styles.yearChipSel]}
                  onPress={() => setFilterYear(y)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.yearChipText, sel && styles.yearChipTextSel]}>{y}년</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : null}

        <View style={styles.totalBox}>
          <Text style={styles.totalLabel}>합계</Text>
          {loading ? (
            <ActivityIndicator color="#42A5F5" />
          ) : (
            <Text style={[styles.totalAmount, totalColor]}>{formatSignedKrw(total)}</Text>
          )}
        </View>

        <TouchableOpacity
          style={styles.addMainBtn}
          onPress={() => router.push('/daily-settlement/edit' as any)}
          activeOpacity={0.85}
        >
          <Text style={styles.addMainBtnText}>정산 추가</Text>
        </TouchableOpacity>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color="#42A5F5" />
          </View>
        ) : flatListMode ? (
          <ScrollView style={styles.listScroll} contentContainerStyle={styles.listContent}>
            {items.length === 0 ? (
              <Text style={styles.empty}>기록이 없습니다. 우측 상단 또는 아래 버튼으로 추가해 보세요.</Text>
            ) : (
              items.map((row) => (
                <TouchableOpacity
                  key={row.date}
                  style={styles.row}
                  onPress={() => router.push(`/daily-settlement/edit?date=${row.date}` as any)}
                  activeOpacity={0.75}
                >
                  <View style={styles.rowLeft}>
                    <Text style={styles.rowDate}>{row.date}</Text>
                    {row.memoPreview ? (
                      <Text style={styles.rowMemo} numberOfLines={1}>
                        {row.memoPreview}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={[styles.rowAmt, row.total >= 0 ? styles.amtPos : styles.amtNeg]}>
                    {formatSignedKrw(row.total)}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        ) : (
          <ScrollView style={styles.listScroll} contentContainerStyle={styles.listContent}>
            {groupedByMonth.length === 0 ? (
              <Text style={styles.empty}>기록이 없습니다.</Text>
            ) : (
              groupedByMonth.map(({ monthKey, rows }) => {
                const collapsed = collapsedMonths.has(monthKey);
                const monthSum = rows.reduce((s, r) => s + r.total, 0);
                return (
                  <View key={monthKey} style={styles.monthSection}>
                    <Pressable
                      style={({ pressed }) => [styles.monthHeader, pressed && { opacity: 0.85 }]}
                      onPress={() => toggleMonth(monthKey)}
                    >
                      <Text style={styles.monthHeaderChevron}>{collapsed ? '▶' : '▼'}</Text>
                      <Text style={styles.monthHeaderTitle}>{monthLabel(monthKey)}</Text>
                      <Text
                        style={[
                          styles.monthHeaderSum,
                          monthSum >= 0 ? styles.amtPos : styles.amtNeg,
                        ]}
                      >
                        {formatSignedKrw(monthSum)}
                      </Text>
                    </Pressable>
                    {!collapsed &&
                      rows.map((row) => (
                        <TouchableOpacity
                          key={row.date}
                          style={styles.rowIndented}
                          onPress={() =>
                            router.push(`/daily-settlement/edit?date=${row.date}` as any)
                          }
                          activeOpacity={0.75}
                        >
                          <View style={styles.rowLeft}>
                            <Text style={styles.rowDateSmall}>{row.date.slice(8)}일</Text>
                            {row.memoPreview ? (
                              <Text style={styles.rowMemo} numberOfLines={1}>
                                {row.memoPreview}
                              </Text>
                            ) : null}
                          </View>
                          <Text
                            style={[styles.rowAmt, row.total >= 0 ? styles.amtPos : styles.amtNeg]}
                          >
                            {formatSignedKrw(row.total)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                  </View>
                );
              })
            )}
          </ScrollView>
        )}

        {showAndroidRangePicker ? (
          <DateTimePicker
            value={pickerDate}
            mode="date"
            display="default"
            onChange={onPickRangeDateAndroid}
          />
        ) : null}

        {Platform.OS === 'ios' ? (
          <Modal visible={showIosRangePicker} transparent animationType="fade">
            <TouchableOpacity
              style={styles.rangeIosOverlay}
              activeOpacity={1}
              onPress={() => {
                setShowIosRangePicker(false);
                rangePickerTargetRef.current = null;
              }}
            >
              <View style={styles.rangeIosBox}>
                <DateTimePicker
                  value={pickerDate}
                  mode="date"
                  display="spinner"
                  themeVariant="dark"
                  onChange={(_, d) => d && setPickerDate(d)}
                  style={styles.rangeIosPicker}
                />
                <TouchableOpacity style={styles.rangeIosOk} onPress={confirmRangeIos} activeOpacity={0.85}>
                  <Text style={styles.rangeIosOkText}>확인</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>
        ) : null}

        <Modal
          visible={backupModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setBackupModalVisible(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setBackupModalVisible(false)}>
            <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.modalTitle}>일일 정산 데이터</Text>
              <Text style={styles.modalDesc}>
                백업 파일을 저장하거나, 저장해 둔 파일로 이 기기의 일일 정산을 복원합니다. 복원 시 기존
                기록은 모두 바뀝니다.
              </Text>
              <TouchableOpacity style={styles.modalPrimary} onPress={() => void runBackup()} activeOpacity={0.85}>
                <Text style={styles.modalPrimaryText}>백업</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSecondary}
                onPress={() => void pickAndRestore()}
                activeOpacity={0.85}
              >
                <Text style={styles.modalSecondaryText}>복원</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalClose}
                onPress={() => setBackupModalVisible(false)}
                activeOpacity={0.85}
              >
                <Text style={styles.modalCloseText}>닫기</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#121212',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  subtitle: {
    color: '#9E9E9E',
    fontSize: 13,
    marginBottom: 12,
  },
  headerBtn: {
    marginRight: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  headerBtnText: {
    color: '#42A5F5',
    fontSize: 16,
    fontWeight: '600',
  },
  addMainBtn: {
    marginBottom: 14,
    backgroundColor: '#42A5F5',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  addMainBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 17,
  },
  tabBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  tabChipsWrap: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tabGearBtn: {
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabGearIcon: {
    fontSize: 17,
    color: '#757575',
    opacity: 0.75,
  },
  rangePanel: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#1a1f2a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a3440',
  },
  rangeDatesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  rangeQuickRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  rangeQuickChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#252b38',
    borderWidth: 1,
    borderColor: '#3d4a5c',
  },
  rangeQuickChipText: {
    color: '#B0BEC5',
    fontSize: 13,
    fontWeight: '600',
  },
  rangeMemoInput: {
    backgroundColor: '#1E1E1E',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: '#FFFFFF',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 10,
  },
  rangeDateChip: {
    flex: 1,
    backgroundColor: '#1E1E1E',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rangeDateVal: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  rangeSep: {
    color: '#757575',
    fontSize: 18,
    paddingHorizontal: 2,
  },
  rangeApplyBtn: {
    backgroundColor: '#42A5F5',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  rangeApplyText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  rangeIosOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  rangeIosBox: {
    backgroundColor: '#1E1E1E',
    paddingBottom: 24,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  rangeIosPicker: {
    alignSelf: 'stretch',
  },
  rangeIosOk: {
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: '#42A5F5',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  rangeIosOkText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  tabChip: {
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1E1E1E',
    borderWidth: 1,
    borderColor: '#333',
  },
  tabChipActive: {
    backgroundColor: '#1a3a52',
    borderColor: '#42A5F5',
  },
  tabChipText: {
    color: '#B0B0B0',
    fontSize: 14,
    fontWeight: '600',
  },
  tabChipTextActive: {
    color: '#FFFFFF',
  },
  yearScroll: {
    marginBottom: 12,
    maxHeight: 40,
  },
  yearScrollInner: {
    gap: 8,
    alignItems: 'center',
    paddingRight: 8,
  },
  yearChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#1E1E1E',
    marginRight: 8,
  },
  yearChipSel: {
    backgroundColor: '#1a3a52',
    borderWidth: 1,
    borderColor: '#42A5F5',
  },
  yearChipText: {
    color: '#B0B0B0',
    fontSize: 13,
  },
  yearChipTextSel: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  totalBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#1a1f2a',
    marginBottom: 12,
  },
  totalLabel: {
    color: '#E0E0E0',
    fontSize: 15,
    fontWeight: '600',
  },
  totalAmount: {
    fontSize: 22,
    fontWeight: '700',
  },
  amtPos: {
    color: '#4CAF50',
  },
  amtNeg: {
    color: '#EF5350',
  },
  loadingBox: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  listScroll: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 32,
  },
  empty: {
    color: '#757575',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#333',
  },
  rowIndented: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingLeft: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2a2a2a',
  },
  rowLeft: {
    flex: 1,
    marginRight: 12,
  },
  rowDate: {
    color: '#E0E0E0',
    fontSize: 16,
    fontWeight: '600',
  },
  rowDateSmall: {
    color: '#BDBDBD',
    fontSize: 14,
    fontWeight: '500',
  },
  rowMemo: {
    color: '#9E9E9E',
    fontSize: 12,
    marginTop: 4,
  },
  rowAmt: {
    fontSize: 16,
    fontWeight: '700',
  },
  monthSection: {
    marginBottom: 8,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    marginBottom: 4,
  },
  monthHeaderChevron: {
    color: '#90CAF9',
    width: 28,
    fontSize: 12,
  },
  monthHeaderTitle: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  monthHeaderSum: {
    fontSize: 15,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
  },
  modalDesc: {
    color: '#9E9E9E',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 18,
  },
  modalPrimary: {
    backgroundColor: '#42A5F5',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  modalPrimaryText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  modalSecondary: {
    backgroundColor: '#2a2820',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#5D4037',
  },
  modalSecondaryText: {
    color: '#FFCC80',
    fontWeight: '700',
    fontSize: 16,
  },
  modalClose: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  modalCloseText: {
    color: '#90A4AE',
    fontSize: 15,
  },
});
