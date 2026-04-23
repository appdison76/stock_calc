import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Stack, useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import {
  deleteSettlementByDate,
  formatDateKey,
  getSettlementByDate,
  saveSettlement,
} from '../../src/services/DailySettlementService';
import type { DailySettlementLine, DailySettlementMode } from '../../src/models/DailySettlement';
import { addCommas } from '../../src/utils/formatUtils';
import { initDatabase } from '../../src/services/DatabaseService';

function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map((x) => parseInt(x, 10));
  return new Date(y, (m || 1) - 1, d || 1);
}

function parseSignedAmountString(raw: string): number {
  const t = raw.replace(/,/g, '').replace(/^\+/, '').trim();
  if (t === '' || t === '-') return 0;
  const n = parseInt(t, 10);
  return Number.isFinite(n) ? n : 0;
}

function formatAmountInput(n: number): string {
  if (n === 0) return '';
  return addCommas(String(n));
}

/** 입력: 숫자·앞쪽 -·콤마 */
function handleSignedAmountChange(text: string, setField: (s: string) => void) {
  let cleaned = text.replace(/[^0-9,\-]/g, '');
  const minus = cleaned.startsWith('-');
  cleaned = cleaned.replace(/-/g, '');
  const parts = cleaned.split(',');
  let digits = parts.join('');
  if (digits.length > 12) digits = digits.slice(0, 12);
  if (digits === '') {
    setField(minus ? '-' : '');
    return;
  }
  const n = parseInt(digits, 10);
  if (!Number.isFinite(n)) {
    setField(minus ? '-' : '');
    return;
  }
  const formatted = addCommas(String(n));
  setField(minus ? `-${formatted}` : formatted);
}

export default function DailySettlementEditScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string }>();
  const initialKey = useMemo(() => {
    const p = params.date;
    if (typeof p === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p)) return p;
    return formatDateKey(new Date());
  }, [params.date]);

  const [dateKey, setDateKey] = useState(initialKey);
  const [pickerDate, setPickerDate] = useState(() => parseDateKey(initialKey));
  const [showIosPicker, setShowIosPicker] = useState(false);
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);

  const [mode, setMode] = useState<DailySettlementMode>('summary');
  const [summaryText, setSummaryText] = useState('');
  const [dailyMemo, setDailyMemo] = useState('');
  const [lines, setLines] = useState<DailySettlementLine[]>([
    { sortOrder: 0, amount: 0, memo: '' },
  ]);
  const [lineAmountTexts, setLineAmountTexts] = useState<string[]>(['']);

  const applyLoaded = useCallback((m: DailySettlementMode, summary: number | null, memo: string, ls: DailySettlementLine[]) => {
    setMode(m);
    setSummaryText(summary != null && summary !== 0 ? formatAmountInput(summary) : '');
    setDailyMemo(memo);
    if (m === 'detail') {
      const arr = ls.length ? ls : [{ sortOrder: 0, amount: 0, memo: '' }];
      setLines(arr);
      setLineAmountTexts(arr.map((l) => (l.amount !== 0 ? formatAmountInput(l.amount) : '')));
    } else {
      setLines([{ sortOrder: 0, amount: 0, memo: '' }]);
      setLineAmountTexts(['']);
    }
  }, []);

  const loadOne = useCallback(async () => {
    try {
      await initDatabase();
      const s = await getSettlementByDate(dateKey);
      if (s) {
        applyLoaded(s.mode, s.summaryAmount, s.dailyMemo, s.lines ?? []);
      } else {
        applyLoaded('summary', null, '', []);
      }
    } catch (e) {
      console.error('일일 정산 로드 오류:', e);
    }
  }, [dateKey, applyLoaded]);

  useFocusEffect(
    useCallback(() => {
      void loadOne();
    }, [loadOne])
  );

  useEffect(() => {
    setDateKey(initialKey);
    setPickerDate(parseDateKey(initialKey));
  }, [initialKey]);

  const onPickDate = (event: { type?: string }, selected?: Date) => {
    if (Platform.OS === 'android') {
      setShowAndroidPicker(false);
      if (event.type === 'dismissed') return;
    }
    if (!selected) return;
    setPickerDate(selected);
    const k = formatDateKey(selected);
    setDateKey(k);
  };

  const openDatePicker = () => {
    setPickerDate(parseDateKey(dateKey));
    if (Platform.OS === 'ios') {
      setShowIosPicker(true);
    } else {
      setShowAndroidPicker(true);
    }
  };

  const persist = async () => {
    try {
      await initDatabase();
      const summaryVal = parseSignedAmountString(summaryText);
      const linePayload: DailySettlementLine[] =
        mode === 'detail'
          ? lines.map((l, i) => ({
              sortOrder: i,
              amount: parseSignedAmountString(lineAmountTexts[i] ?? ''),
              memo: l.memo,
            }))
          : [];

      if (mode === 'summary') {
        await saveSettlement({
          date: dateKey,
          mode: 'summary',
          summaryAmount: summaryVal,
          dailyMemo: dailyMemo.trim(),
          lines: [],
        });
      } else {
        await saveSettlement({
          date: dateKey,
          mode: 'detail',
          summaryAmount: null,
          dailyMemo: dailyMemo.trim(),
          lines: linePayload,
        });
      }
      Alert.alert('저장했어요', `${dateKey} 반영됐어요.`, [
        {
          text: '확인',
          onPress: () => router.back(),
        },
      ]);
    } catch (e) {
      console.error('일일 정산 저장 오류:', e);
      Alert.alert('저장 실패', '잠시 후 다시 시도해 주세요.');
    }
  };

  const confirmDelete = () => {
    Alert.alert('삭제', '이 날짜의 정산을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            await initDatabase();
            await deleteSettlementByDate(dateKey);
            router.back();
          } catch (e) {
            Alert.alert('오류', '삭제에 실패했습니다.');
          }
        },
      },
    ]);
  };

  const addLine = () => {
    const next = [...lines, { sortOrder: lines.length, amount: 0, memo: '' }];
    setLines(next);
    setLineAmountTexts([...lineAmountTexts, '']);
  };

  const removeLine = (idx: number) => {
    if (lines.length <= 1) return;
    setLines(lines.filter((_, i) => i !== idx).map((l, i) => ({ ...l, sortOrder: i })));
    setLineAmountTexts(lineAmountTexts.filter((_, i) => i !== idx));
  };

  const updateLineMemo = (idx: number, memo: string) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, memo } : l)));
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: '일일 정산',
          headerRight: () => (
            <TouchableOpacity onPress={() => void persist()} style={styles.headerSave} activeOpacity={0.7}>
              <Text style={styles.headerSaveText}>저장</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.hint}>금액·메모·일별 요약</Text>

          <Text style={styles.label}>날짜</Text>
          <TouchableOpacity style={styles.dateBtn} onPress={openDatePicker} activeOpacity={0.8}>
            <Text style={styles.dateBtnText}>{dateKey}</Text>
            <Text style={styles.dateBtnChev}>▼</Text>
          </TouchableOpacity>

          {showAndroidPicker ? (
            <DateTimePicker
              value={pickerDate}
              mode="date"
              display="default"
              onChange={onPickDate}
            />
          ) : null}

          {Platform.OS === 'ios' ? (
            <Modal visible={showIosPicker} transparent animationType="fade">
              <TouchableOpacity
                style={styles.iosModalOverlay}
                activeOpacity={1}
                onPress={() => setShowIosPicker(false)}
              >
                <View style={styles.iosModalBox}>
                  <DateTimePicker
                    value={pickerDate}
                    mode="date"
                    display="spinner"
                    themeVariant="dark"
                    onChange={(_, d) => d && setPickerDate(d)}
                    style={styles.iosPicker}
                  />
                  <TouchableOpacity
                    style={styles.iosModalOk}
                    onPress={() => {
                      const k = formatDateKey(pickerDate);
                      setDateKey(k);
                      setShowIosPicker(false);
                    }}
                  >
                    <Text style={styles.iosModalOkText}>확인</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </Modal>
          ) : null}

          <Text style={styles.label}>형식</Text>
          <View style={styles.modeRow}>
            <TouchableOpacity
              style={[styles.modeChip, mode === 'summary' && styles.modeChipOn]}
              onPress={() => setMode('summary')}
              activeOpacity={0.85}
            >
              <Text style={[styles.modeChipText, mode === 'summary' && styles.modeChipTextOn]}>
                요약 (하루 총액)
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeChip, mode === 'detail' && styles.modeChipOn]}
              onPress={() => setMode('detail')}
              activeOpacity={0.85}
            >
              <Text style={[styles.modeChipText, mode === 'detail' && styles.modeChipOn]}>
                상세 (±줄)
              </Text>
            </TouchableOpacity>
          </View>

          {mode === 'summary' ? (
            <>
              <Text style={styles.label}>오늘 손익 (원)</Text>
              <TextInput
                style={styles.input}
                value={summaryText}
                onChangeText={(t) => handleSignedAmountChange(t, setSummaryText)}
                keyboardType="numbers-and-punctuation"
                placeholder="예: -50,000"
                placeholderTextColor="#666"
              />
            </>
          ) : (
            <>
              <View style={styles.linesHeader}>
                <Text style={styles.label}>항목별 금액</Text>
                <TouchableOpacity onPress={addLine} activeOpacity={0.8}>
                  <Text style={styles.addLine}>+ 줄 추가</Text>
                </TouchableOpacity>
              </View>
              {lines.map((line, idx) => (
                <View key={idx} style={styles.lineBlock}>
                  <View style={styles.lineAmtRow}>
                    <TextInput
                      style={[styles.input, styles.lineAmtInput]}
                      value={lineAmountTexts[idx] ?? ''}
                      onChangeText={(t) => {
                        handleSignedAmountChange(t, (v) => {
                          setLineAmountTexts((prev) => {
                            const next = [...prev];
                            next[idx] = v;
                            return next;
                          });
                        });
                      }}
                      keyboardType="numbers-and-punctuation"
                      placeholder="금액"
                      placeholderTextColor="#666"
                    />
                    {lines.length > 1 ? (
                      <TouchableOpacity onPress={() => removeLine(idx)} style={styles.removeLineBtn}>
                        <Text style={styles.removeLineText}>−</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.removeLinePlaceholder} />
                    )}
                  </View>
                  <TextInput
                    style={[styles.input, styles.memoInput]}
                    value={line.memo}
                    onChangeText={(t) => updateLineMemo(idx, t)}
                    placeholder="줄 메모"
                    placeholderTextColor="#666"
                  />
                </View>
              ))}
            </>
          )}

          <Text style={styles.label}>일별 메모</Text>
          <TextInput
            style={[styles.input, styles.memoMultiline]}
            value={dailyMemo}
            onChangeText={setDailyMemo}
            placeholder="그날 한 줄 메모 (선택)"
            placeholderTextColor="#666"
            multiline
          />

          <TouchableOpacity style={styles.saveBtn} onPress={() => void persist()} activeOpacity={0.85}>
            <Text style={styles.saveBtnText}>저장</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.deleteBtn} onPress={confirmDelete} activeOpacity={0.85}>
            <Text style={styles.deleteBtnText}>이 날짜 삭제</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#121212' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 48 },
  hint: {
    color: '#9E9E9E',
    fontSize: 13,
    marginBottom: 16,
  },
  label: {
    color: '#BDBDBD',
    fontSize: 13,
    marginBottom: 8,
    marginTop: 12,
  },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E1E1E',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#333',
  },
  dateBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  dateBtnChev: {
    color: '#90CAF9',
    fontSize: 12,
  },
  iosModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  iosModalBox: {
    backgroundColor: '#1E1E1E',
    paddingBottom: 24,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  iosPicker: { alignSelf: 'stretch' },
  iosModalOk: {
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: '#42A5F5',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  iosModalOkText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modeChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#1E1E1E',
    borderWidth: 1,
    borderColor: '#333',
    alignItems: 'center',
  },
  modeChipOn: {
    borderColor: '#42A5F5',
    backgroundColor: '#1a3a52',
  },
  modeChipText: {
    color: '#B0B0B0',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  modeChipTextOn: {
    color: '#FFFFFF',
  },
  input: {
    backgroundColor: '#1E1E1E',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  memoMultiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  linesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  addLine: {
    color: '#42A5F5',
    fontSize: 14,
    fontWeight: '600',
  },
  lineBlock: {
    marginBottom: 12,
  },
  lineAmtRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lineAmtInput: {
    flex: 1,
  },
  memoInput: {
    marginTop: 8,
  },
  removeLineBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#332222',
    borderRadius: 8,
  },
  removeLineText: {
    color: '#EF5350',
    fontSize: 22,
    fontWeight: '700',
  },
  removeLinePlaceholder: {
    width: 44,
  },
  saveBtn: {
    marginTop: 28,
    backgroundColor: '#42A5F5',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 17,
  },
  deleteBtn: {
    marginTop: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  deleteBtnText: {
    color: '#EF5350',
    fontSize: 15,
  },
  headerSave: {
    marginRight: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  headerSaveText: {
    color: '#42A5F5',
    fontSize: 16,
    fontWeight: '600',
  },
});
