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
  Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SettingsService } from '../src/services/SettingsService';

type SettingsTab = 'main' | 'fee';

export default function SettingsView() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('main');
  
  // 수수료 설정
  const [krwTaxRate, setKrwTaxRate] = useState('');
  const [krwFeeRate, setKrwFeeRate] = useState('');
  const [usdTaxRate, setUsdTaxRate] = useState('');
  const [usdFeeRate, setUsdFeeRate] = useState('');
  
  // 메인화면 표시 설정
  const [showMarketIndicators, setShowMarketIndicators] = useState(true);
  const [showMiniBanners, setShowMiniBanners] = useState(true);
  const [showPortfolio, setShowPortfolio] = useState(true);
  const [showRelatedNews, setShowRelatedNews] = useState(true);
  const [showLatestNews, setShowLatestNews] = useState(true);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      // 수수료 설정 로드
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

      // 메인화면 표시 설정 로드
      const [
        marketIndicators,
        miniBanners,
        portfolio,
        relatedNews,
        latestNews,
      ] = await Promise.all([
        SettingsService.getShowMarketIndicators(),
        SettingsService.getShowMiniBanners(),
        SettingsService.getShowPortfolio(),
        SettingsService.getShowRelatedNews(),
        SettingsService.getShowLatestNews(),
      ]);

      setShowMarketIndicators(marketIndicators);
      setShowMiniBanners(miniBanners);
      setShowPortfolio(portfolio);
      setShowRelatedNews(relatedNews);
      setShowLatestNews(latestNews);
    } catch (e) {
      Alert.alert('오류', '설정을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async () => {
    if (activeTab === 'fee') {
      // 수수료 설정 저장
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
    } else {
      // 메인화면 표시 설정 저장
      setIsSaving(true);
      try {
        await Promise.all([
          SettingsService.setShowMarketIndicators(showMarketIndicators),
          SettingsService.setShowMiniBanners(showMiniBanners),
          SettingsService.setShowPortfolio(showPortfolio),
          SettingsService.setShowRelatedNews(showRelatedNews),
          SettingsService.setShowLatestNews(showLatestNews),
        ]);

        Alert.alert('성공', '설정이 저장되었습니다.');
      } catch (e) {
        Alert.alert('오류', '설정 저장 중 오류가 발생했습니다.');
      } finally {
        setIsSaving(false);
      }
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
        {/* 탭 메뉴 */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'main' && styles.tabActive]}
            onPress={() => setActiveTab('main')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === 'main' && styles.tabTextActive]}>
              메인화면 설정
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'fee' && styles.tabActive]}
            onPress={() => setActiveTab('fee')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === 'fee' && styles.tabTextActive]}>
              수수료 설정
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {activeTab === 'main' ? (
            /* 메인화면 설정 */
            <>
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={[styles.iconContainer, { backgroundColor: 'rgba(66, 165, 245, 0.2)' }]}>
                    <Text style={styles.iconText}>🏠</Text>
                  </View>
                  <Text style={styles.cardTitle}>메인화면 표시 설정</Text>
                </View>

                <View style={styles.settingRow}>
                  <View style={styles.settingLabelContainer}>
                    <Text style={styles.settingLabel}>주요 지표 영역</Text>
                    <Text style={styles.settingDescription}>상단 4개의 주요지표 표시</Text>
                  </View>
                  <Switch
                    value={showMarketIndicators}
                    onValueChange={setShowMarketIndicators}
                    trackColor={{ false: '#757575', true: '#42A5F5' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={styles.settingRow}>
                  <View style={styles.settingLabelContainer}>
                    <Text style={styles.settingLabel}>미니배너 영역</Text>
                    <Text style={styles.settingDescription}>포트폴리오, 매매기록 등 미니배너 표시</Text>
                  </View>
                  <Switch
                    value={showMiniBanners}
                    onValueChange={setShowMiniBanners}
                    trackColor={{ false: '#757575', true: '#42A5F5' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={styles.settingRow}>
                  <View style={styles.settingLabelContainer}>
                    <Text style={styles.settingLabel}>포트폴리오 영역</Text>
                    <Text style={styles.settingDescription}>내 포트폴리오 종목 목록 표시</Text>
                  </View>
                  <Switch
                    value={showPortfolio}
                    onValueChange={setShowPortfolio}
                    trackColor={{ false: '#757575', true: '#42A5F5' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={styles.settingRow}>
                  <View style={styles.settingLabelContainer}>
                    <Text style={styles.settingLabel}>관련 뉴스 영역</Text>
                    <Text style={styles.settingDescription}>포트폴리오 종목 관련 뉴스 표시</Text>
                  </View>
                  <Switch
                    value={showRelatedNews}
                    onValueChange={setShowRelatedNews}
                    trackColor={{ false: '#757575', true: '#42A5F5' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={styles.settingRow}>
                  <View style={styles.settingLabelContainer}>
                    <Text style={styles.settingLabel}>최신 뉴스 영역</Text>
                    <Text style={styles.settingDescription}>최신 주식 뉴스 표시</Text>
                  </View>
                  <Switch
                    value={showLatestNews}
                    onValueChange={setShowLatestNews}
                    trackColor={{ false: '#757575', true: '#42A5F5' }}
                    thumbColor="#FFFFFF"
                  />
                </View>
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
            </>
          ) : (
            /* 수수료 설정 */
            <>
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
            </>
          )}
        </ScrollView>
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
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(27, 38, 59, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(66, 165, 245, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: 'rgba(66, 165, 245, 0.2)',
    borderColor: '#42A5F5',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9E9E9E',
  },
  tabTextActive: {
    color: '#FFFFFF',
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
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(66, 165, 245, 0.1)',
  },
  settingLabelContainer: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 12,
    color: '#9E9E9E',
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
});
