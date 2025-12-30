import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SettingsService } from '../src/services/SettingsService';

export default function SettingsView() {
  const [krwTaxRate, setKrwTaxRate] = useState('');
  const [krwFeeRate, setKrwFeeRate] = useState('');
  const [usdTaxRate, setUsdTaxRate] = useState('');
  const [usdFeeRate, setUsdFeeRate] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPrivacyModalVisible, setIsPrivacyModalVisible] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const [krwTax, krwFee, usdTax, usdFee] = await Promise.all([
        SettingsService.getKrwTaxRate(),
        SettingsService.getKrwFeeRate(),
        SettingsService.getUsdTaxRate(),
        SettingsService.getUsdFeeRate(),
      ]);

      setKrwTaxRate(krwTax.toString());
      setKrwFeeRate(krwFee.toString());
      setUsdTaxRate(usdTax.toString());
      setUsdFeeRate(usdFee.toString());
    } catch (e) {
      Alert.alert('오류', '설정을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async () => {
    // 유효성 검사
    if (!krwTaxRate || !krwFeeRate || !usdTaxRate || !usdFeeRate) {
      Alert.alert('입력 오류', '모든 필드를 입력해주세요.');
      return;
    }

    const krwTaxNum = parseFloat(krwTaxRate);
    const krwFeeNum = parseFloat(krwFeeRate);
    const usdTaxNum = parseFloat(usdTaxRate);
    const usdFeeNum = parseFloat(usdFeeRate);

    if (isNaN(krwTaxNum) || krwTaxNum < 0) {
      Alert.alert('입력 오류', '올바른 원화 거래세율을 입력하세요.');
      return;
    }

    if (isNaN(krwFeeNum) || krwFeeNum < 0) {
      Alert.alert('입력 오류', '올바른 원화 수수료율을 입력하세요.');
      return;
    }

    if (isNaN(usdTaxNum) || usdTaxNum < 0) {
      Alert.alert('입력 오류', '올바른 달러 거래세율을 입력하세요.');
      return;
    }

    if (isNaN(usdFeeNum) || usdFeeNum < 0) {
      Alert.alert('입력 오류', '올바른 달러 수수료율을 입력하세요.');
      return;
    }

    setIsSaving(true);
    try {
      await Promise.all([
        SettingsService.setKrwTaxRate(krwTaxNum),
        SettingsService.setKrwFeeRate(krwFeeNum),
        SettingsService.setUsdTaxRate(usdTaxNum),
        SettingsService.setUsdFeeRate(usdFeeNum),
      ]);

      Alert.alert('성공', '설정이 저장되었습니다.');
    } catch (e) {
      Alert.alert('오류', '설정 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <LinearGradient
        colors={['#0D1B2A', '#1B263B', '#0F1419']}
        style={styles.loadingContainer}
      >
        <ActivityIndicator size="large" color="#42A5F5" />
      </LinearGradient>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <LinearGradient
        colors={['#0D1B2A', '#1B263B', '#0F1419']}
        style={styles.gradient}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
      {/* 원화 설정 */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconContainer, { backgroundColor: 'rgba(66, 165, 245, 0.2)' }]}>
            <Text style={styles.iconText}>💱</Text>
          </View>
          <Text style={styles.cardTitle}>원화 (KRW) 설정</Text>
        </View>

        <TextInput
          style={styles.input}
          placeholder="거래세 (%)"
          placeholderTextColor="#757575"
          value={krwTaxRate}
          onChangeText={setKrwTaxRate}
          keyboardType="numeric"
        />
        <Text style={styles.helperText}>예: 0.15 (0.15%)</Text>

        <TextInput
          style={styles.input}
          placeholder="수수료 (%)"
          placeholderTextColor="#757575"
          value={krwFeeRate}
          onChangeText={setKrwFeeRate}
          keyboardType="numeric"
        />
        <Text style={styles.helperText}>예: 0.015 (0.015%)</Text>
      </View>

      {/* 달러 설정 */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconContainer, { backgroundColor: 'rgba(76, 175, 80, 0.2)' }]}>
            <Text style={styles.iconText}>💵</Text>
          </View>
          <Text style={styles.cardTitle}>달러 (USD) 설정</Text>
        </View>

        <TextInput
          style={styles.input}
          placeholder="거래세 (%)"
          placeholderTextColor="#757575"
          value={usdTaxRate}
          onChangeText={setUsdTaxRate}
          keyboardType="numeric"
        />
        <Text style={styles.helperText}>예: 0.15 (0.15%)</Text>

        <TextInput
          style={styles.input}
          placeholder="수수료 (%)"
          placeholderTextColor="#757575"
          value={usdFeeRate}
          onChangeText={setUsdFeeRate}
          keyboardType="numeric"
        />
        <Text style={styles.helperText}>예: 0.015 (0.015%)</Text>
      </View>

      <TouchableOpacity
        style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
        onPress={saveSettings}
        disabled={isSaving}
      >
        {isSaving ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text style={styles.saveButtonText}>저장</Text>
        )}
      </TouchableOpacity>
        </ScrollView>

        {/* 개인정보처리방침 Modal */}
        <Modal
        visible={isPrivacyModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsPrivacyModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>개인정보처리방침</Text>
            </View>
            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={true}>
              <View style={styles.privacySection}>
                <Text style={styles.privacySectionTitle}>수집하는 항목</Text>
                <Text style={styles.privacyText}>
                  본 앱은 회원가입이나 로그인을 요구하지 않으며, 어떠한 개인정보도 직접 수집하거나 저장하지 않습니다.
                </Text>
              </View>

              <View style={styles.privacySection}>
                <Text style={styles.privacySectionTitle}>광고 관련</Text>
                <Text style={styles.privacyText}>
                  구글 애드몹(AdMob) 광고 송출을 위해 기기 식별자 및 광고 ID가 활용될 수 있습니다.
                </Text>
              </View>

              <View style={styles.privacySection}>
                <Text style={styles.privacySectionTitle}>데이터 보관</Text>
                <Text style={styles.privacyText}>
                  사용자가 입력한 계산 데이터는 앱 종료 시 휘발되거나 사용자의 기기에만 임시 저장됩니다.
                </Text>
              </View>

              <View style={styles.privacySection}>
                <Text style={styles.privacySectionTitle}>문의</Text>
                <Text style={styles.privacyText}>
                  서비스 관련 문의는 네오비저닝(Neo Visioning)으로 연락 주시기 바랍니다.
                </Text>
              </View>
            </ScrollView>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setIsPrivacyModalVisible(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.modalCloseButtonText}>닫기</Text>
            </TouchableOpacity>
          </View>
        </View>
        </Modal>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: 'rgba(13, 27, 42, 0.8)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(66, 165, 245, 0.1)',
    padding: 16,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconText: {
    fontSize: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  input: {
    backgroundColor: 'rgba(27, 38, 59, 0.6)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(66, 165, 245, 0.2)',
    padding: 16,
    color: '#FFFFFF',
    fontSize: 16,
    marginBottom: 4,
  },
  helperText: {
    fontSize: 12,
    color: '#757575',
    marginBottom: 16,
    marginLeft: 4,
  },
  saveButton: {
    backgroundColor: '#42A5F5',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.67)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: 'rgba(13, 27, 42, 0.95)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(66, 165, 245, 0.2)',
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(66, 165, 245, 0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  privacySection: {
    marginBottom: 24,
  },
  privacySectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#42A5F5',
    marginBottom: 8,
  },
  privacyText: {
    fontSize: 14,
    color: '#E0E0E0',
    lineHeight: 20,
  },
  modalCloseButton: {
    backgroundColor: '#42A5F5',
    borderRadius: 12,
    paddingVertical: 14,
    margin: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

