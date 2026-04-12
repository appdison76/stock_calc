import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Modal,
  TextInput,
  Alert,
  Linking,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { AdmobBanner } from '../src/components/AdmobBanner';
import type { MyShortcut } from '../src/models/MyShortcut';
import {
  loadMyShortcuts,
  addMyShortcut,
  updateMyShortcut,
  deleteMyShortcut,
  reorderShortcutInList,
  displayEmoji,
  suggestedEmojiForUrl,
  DEFAULT_FEAR_GREED_ID,
} from '../src/services/MyShortcutsService';

type Draft = {
  id: string | null;
  title: string;
  url: string;
  iconEmoji: string;
  showOnMain: boolean;
};

const emptyDraft = (): Draft => ({
  id: null,
  title: '',
  url: '',
  iconEmoji: '',
  showOnMain: true,
});

export default function ShortcutManagerScreen() {
  const insets = useSafeAreaInsets();
  const [list, setList] = useState<MyShortcut[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const l = await loadMyShortcuts();
      setList(l);
    } catch (e) {
      console.error('바로가기 로드 오류:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      refresh();
    }, [refresh])
  );

  const openUrl = (url: string) => {
    Linking.openURL(url).catch(() => Alert.alert('오류', '링크를 열 수 없습니다.'));
  };

  const onAdd = () => {
    setDraft(emptyDraft());
    setModalVisible(true);
  };

  const onEdit = (s: MyShortcut) => {
    setDraft({
      id: s.id,
      title: s.title,
      url: s.url,
      iconEmoji: s.iconEmoji || '',
      showOnMain: s.showOnMain,
    });
    setModalVisible(true);
  };

  const onSaveDraft = async () => {
    const url = draft.url.trim();
    if (!url) {
      Alert.alert('입력', '링크(URL)를 입력해주세요.');
      return;
    }
    setSaving(true);
    try {
      if (draft.id) {
        const next = await updateMyShortcut(draft.id, {
          title: draft.title,
          url,
          iconEmoji: draft.iconEmoji,
          showOnMain: draft.showOnMain,
        });
        setList(next);
      } else {
        const next = await addMyShortcut({
          title: draft.title,
          url,
          iconEmoji: draft.iconEmoji || undefined,
          showOnMain: draft.showOnMain,
        });
        setList(next);
      }
      setModalVisible(false);
      setDraft(emptyDraft());
    } catch (e) {
      Alert.alert('오류', e instanceof Error ? e.message : '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = (s: MyShortcut) => {
    if (s.isDefault) {
      Alert.alert('알림', '앱에서 제공하는 기본 바로가기는 삭제할 수 없습니다.');
      return;
    }
    Alert.alert('삭제', `"${s.title}" 바로가기를 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          const next = await deleteMyShortcut(s.id);
          setList(next);
        },
      },
    ]);
  };

  const onReorder = async (id: string, dir: -1 | 1) => {
    const next = await reorderShortcutInList(id, dir);
    setList(next);
  };

  const bottomPad =
    24 +
    insets.bottom +
    (Platform.OS === 'android' && insets.bottom < 28 ? 28 - insets.bottom : 0);

  return (
    <LinearGradient colors={['#121212', '#1a1a2e']} style={styles.screen}>
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color="#42A5F5" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }]}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.hint}>
            메인에 보일 항목은 스위치로 켜고, 순서는 ↑↓로 바꿀 수 있습니다. 유튜브 링크는 이모지를 비우면 📺이
            기본입니다.
          </Text>

          <TouchableOpacity style={styles.addBtn} onPress={onAdd} activeOpacity={0.85}>
            <Text style={styles.addBtnText}>+ 바로가기 추가</Text>
          </TouchableOpacity>

          <View style={styles.bannerSlot}>
            <AdmobBanner />
          </View>

          {list.map((s) => (
            <View key={s.id} style={styles.rowCard}>
              <TouchableOpacity style={styles.rowMain} onPress={() => openUrl(s.url)} activeOpacity={0.75}>
                <Text style={styles.rowEmoji}>{displayEmoji(s)}</Text>
                <View style={styles.rowTextCol}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {s.title}
                  </Text>
                  <Text style={styles.rowUrl} numberOfLines={1}>
                    {s.url}
                  </Text>
                </View>
              </TouchableOpacity>

              <View style={styles.rowSwitchRow}>
                <Text style={styles.rowSwitchLabel}>메인 표시</Text>
                <Switch
                  value={s.showOnMain}
                  onValueChange={async (v) => {
                    const next = await updateMyShortcut(s.id, { showOnMain: v });
                    setList(next);
                  }}
                  trackColor={{ false: '#555', true: '#42A5F5' }}
                  thumbColor="#fff"
                />
              </View>

              <View style={styles.rowActions}>
                <TouchableOpacity
                  style={[styles.smallBtn, styles.openBtn]}
                  onPress={() => openUrl(s.url)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.smallBtnText, styles.openBtnText]}>열기</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.smallBtn} onPress={() => onReorder(s.id, -1)}>
                  <Text style={styles.smallBtnText}>↑</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.smallBtn} onPress={() => onReorder(s.id, 1)}>
                  <Text style={styles.smallBtnText}>↓</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.smallBtn} onPress={() => onEdit(s)}>
                  <Text style={styles.smallBtnText}>수정</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.smallBtn, s.isDefault && styles.smallBtnDisabled]}
                  onPress={() => onDelete(s)}
                  disabled={s.isDefault}
                >
                  <Text style={[styles.smallBtnText, s.isDefault && styles.smallBtnTextDisabled]}>삭제</Text>
                </TouchableOpacity>
              </View>
              {s.id === DEFAULT_FEAR_GREED_ID && (
                <Text style={styles.defaultBadge}>앱 기본 · 삭제 불가</Text>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalCard, { paddingBottom: 16 + insets.bottom }]}>
            <Text style={styles.modalTitle}>{draft.id ? '바로가기 수정' : '바로가기 추가'}</Text>

            <Text style={styles.fieldLabel}>이름 (비우면 주소에서 자동)</Text>
            <TextInput
              style={styles.input}
              value={draft.title}
              onChangeText={(t) => setDraft((d) => ({ ...d, title: t }))}
              placeholder="예: 내 유튜브"
              placeholderTextColor="#789"
            />

            <Text style={styles.fieldLabel}>링크 (필수)</Text>
            <TextInput
              style={styles.input}
              value={draft.url}
              onChangeText={(t) => setDraft((d) => ({ ...d, url: t }))}
              placeholder="https://..."
              placeholderTextColor="#789"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />

            <Text style={styles.fieldLabel}>이모지 (비우면 링크 기준 자동: 유튜브 📺, 그 외 🔗)</Text>
            <TextInput
              style={styles.input}
              value={draft.iconEmoji}
              onChangeText={(t) => setDraft((d) => ({ ...d, iconEmoji: t }))}
              placeholder={suggestedEmojiForUrl(draft.url || 'https://')}
              placeholderTextColor="#789"
              maxLength={8}
            />

            <View style={styles.modalSwitchRow}>
              <Text style={styles.fieldLabel}>메인 화면에 표시</Text>
              <Switch
                value={draft.showOnMain}
                onValueChange={(v) => setDraft((d) => ({ ...d, showOnMain: v }))}
                trackColor={{ false: '#555', true: '#42A5F5' }}
                thumbColor="#fff"
              />
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setModalVisible(false)}>
                <Text style={styles.modalCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSave, saving && styles.modalSaveDisabled]}
                onPress={onSaveDraft}
                disabled={saving}
              >
                <Text style={styles.modalSaveText}>{saving ? '저장 중…' : '저장'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 16, paddingTop: 12 },
  hint: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 16,
  },
  addBtn: {
    backgroundColor: 'rgba(66, 165, 245, 0.25)',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(66, 165, 245, 0.45)',
  },
  addBtnText: { color: '#42A5F5', fontWeight: '700', fontSize: 16 },
  bannerSlot: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
  },
  rowCard: {
    backgroundColor: 'rgba(45, 45, 45, 0.75)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  rowMain: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  rowEmoji: { fontSize: 28, marginRight: 12, width: 40, textAlign: 'center' },
  rowTextCol: { flex: 1, minWidth: 0 },
  rowTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  rowUrl: { color: '#789', fontSize: 12, marginTop: 4 },
  rowSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  rowSwitchLabel: { color: '#B0BEC5', fontSize: 14 },
  rowActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  smallBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  smallBtnDisabled: { opacity: 0.4 },
  smallBtnText: { color: '#ECEFF1', fontSize: 13, fontWeight: '600' },
  smallBtnTextDisabled: { color: '#789' },
  openBtn: {
    backgroundColor: 'rgba(66, 165, 245, 0.32)',
    borderWidth: 1,
    borderColor: 'rgba(66, 165, 245, 0.5)',
  },
  openBtnText: {
    color: '#E3F2FD',
    fontWeight: '700',
  },
  defaultBadge: { marginTop: 8, color: '#789', fontSize: 12 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#1e1e1e',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(66, 165, 245, 0.2)',
  },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 16 },
  fieldLabel: { color: '#B0BEC5', fontSize: 13, marginBottom: 6, marginTop: 8 },
  input: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  modalSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 24,
    gap: 12,
  },
  modalCancel: { paddingVertical: 12, paddingHorizontal: 20 },
  modalCancelText: { color: '#94A3B8', fontSize: 16, fontWeight: '600' },
  modalSave: {
    backgroundColor: '#42A5F5',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  modalSaveDisabled: { opacity: 0.6 },
  modalSaveText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
