import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { AdmobBanner } from '../src/components/AdmobBanner';

interface CalculatorCardProps {
  title: string;
  description: string | string[];
  icon: string;
  color: string;
  onPress: () => void;
}

const CalculatorCard: React.FC<CalculatorCardProps> = ({
  title,
  description,
  icon,
  color,
  onPress,
}) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={styles.card}
    >
      <LinearGradient
        colors={['rgba(13, 27, 42, 0.8)', 'rgba(27, 38, 59, 0.6)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.cardGradient}
      >
        <View style={styles.cardContent}>
          <View style={[styles.iconContainer, { borderColor: `${color}40` }]}>
            <Text style={[styles.icon, { color }]}>{icon}</Text>
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.cardTitle}>{title}</Text>
            <View style={styles.descriptionContainer}>
              {(Array.isArray(description) ? description : description.split('\n')).map((line, index) => (
                <Text key={index} style={[styles.cardDescription, index > 0 && styles.descriptionSpacing]}>
                  {line}
                </Text>
              ))}
            </View>
          </View>
          <Text style={[styles.arrow, { color: '#42A5F5' }]}>→</Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
};

export default function MainScreen() {
  const router = useRouter();
  const [isPrivacyModalVisible, setIsPrivacyModalVisible] = useState(false);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0D1B2A', '#1B263B', '#0F1419']}
        style={styles.gradient}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.headerIconContainer}>
              <Text style={styles.headerIcon}>📈</Text>
            </View>
            <Text style={styles.headerTitle}>스마트 물타기 계산기</Text>
            <Text style={styles.headerSubtitle}>
              평단가 & 수익률 계산
            </Text>
            <View style={styles.subtitleContainer}>
              <Text style={styles.headerFeature}>
                한국·미국 주식 지원
              </Text>
              <Text style={styles.headerFeature}>
                반복 물타기 계산
              </Text>
            </View>
          </View>

          <View style={styles.cardsContainer}>
            <CalculatorCard
              title="수익률 계산기"
              description={['매수가, 매도가, 수량을 입력하여', '수익률과 순수익을 계산합니다']}
              icon="%"
              color="#42A5F5"
              onPress={() => router.push('/profit')}
            />
            <View style={styles.cardSpacer} />

            <CalculatorCard
              title="물타기 계산기"
              description={['현재 보유 주식과 추가 매수 정보를 합산하여 새로운', '평균 단가를 계산합니다']}
              icon="💧"
              color="#4CAF50"
              onPress={() => router.push('/averaging')}
            />
            <View style={styles.cardSpacer} />

            <CalculatorCard
              title="포트폴리오"
              description={['나의 포트폴리오와 종목을 저장하여', '매매기록을 관리합니다']}
              icon="📊"
              color="#FF9800"
              onPress={() => router.push('/portfolios')}
            />
            <View style={styles.cardSpacer} />

            <CalculatorCard
              title="매매기록 차트"
              description={['저장된 매매 기록을', '차트로 시각화하여 확인합니다']}
              icon="📉"
              color="#9C27B0"
              onPress={() => router.push('/visualization')}
            />
          </View>

          <View style={styles.adSpacer} />

          <View style={styles.adContainer}>
            <AdmobBanner />
          </View>

          <View style={styles.adSpacer} />

          <View style={styles.cardsContainer}>
            <CalculatorCard
              title="환경설정"
              description={['거래세와 수수료를', '원화/달러별로 설정합니다']}
              icon="⚙"
              color="#64B5F6"
              onPress={() => router.push('/settings')}
            />
          </View>

          <View style={styles.brandingContainer}>
            <Text style={styles.brandingText}>Powered by Neo Visioning</Text>
            <TouchableOpacity
              onPress={() => setIsPrivacyModalVisible(true)}
              activeOpacity={0.7}
              style={styles.privacyLinkContainer}
            >
              <Text style={styles.privacyLink}>개인정보처리방침</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </LinearGradient>

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D1B2A',
  },
  gradient: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingTop: 60,
    paddingBottom: 120,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100%',
  },
  header: {
    alignItems: 'center',
    marginBottom: 56,
  },
  headerIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 24,
    backgroundColor: 'rgba(66, 165, 245, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: 'rgba(66, 165, 245, 0.3)',
  },
  headerIcon: {
    fontSize: 56,
    fontWeight: '700',
    color: '#42A5F5',
  },
  headerTitle: {
    fontSize: 38,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 16,
    letterSpacing: 2,
    textAlign: 'center',
    textShadowColor: 'rgba(66, 165, 245, 0.4)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 6,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  subtitleContainer: {
    alignItems: 'center',
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(66, 165, 245, 0.2)',
    width: '60%',
  },
  headerSubtitle: {
    fontSize: 18,
    color: '#E3F2FD',
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 12,
    fontWeight: '600',
  },
  headerFeature: {
    fontSize: 15,
    color: '#B0BEC5',
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 8,
    fontWeight: '500',
  },
  cardsContainer: {
    width: '100%',
  },
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
  },
  cardGradient: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(66, 165, 245, 0.1)',
    backgroundColor: 'rgba(13, 27, 42, 0.6)',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 32,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 24,
    alignSelf: 'center',
    borderWidth: 1.5,
    backgroundColor: 'rgba(13, 27, 42, 0.4)',
  },
  icon: {
    fontSize: 32,
    fontWeight: '600',
  },
  textContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
    letterSpacing: -0.4,
  },
  descriptionContainer: {
    // gap 대신 marginBottom 사용
  },
  cardDescription: {
    fontSize: 15,
    color: '#BDBDBD',
    lineHeight: 21,
  },
  descriptionSpacing: {
    marginTop: 2,
  },
  arrow: {
    fontSize: 24,
    fontWeight: '600',
    marginLeft: 16,
    color: '#42A5F5',
  },
  cardSpacer: {
    height: 20,
  },
  brandingContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 8,
  },
  brandingText: {
    fontSize: 12,
    color: '#888888',
    letterSpacing: 0.5,
  },
  privacyLinkContainer: {
    marginTop: 8,
  },
  privacyLink: {
    fontSize: 12,
    color: '#42A5F5',
    textDecorationLine: 'underline',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.67)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#424242',
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    height: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#424242',
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
    backgroundColor: '#1976D2',
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
  adSpacer: {
    height: 12,
  },
  adContainer: {
    width: '100%',
    marginTop: 0,
    marginBottom: 0,
  },
});
