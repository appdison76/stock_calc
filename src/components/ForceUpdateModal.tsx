import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { openPlayStore } from '../services/versionCheck';

interface ForceUpdateModalProps {
  visible: boolean;
  currentVersion: string;
  requiredVersion: string;
}

export default function ForceUpdateModal({
  visible,
  currentVersion,
  requiredVersion,
}: ForceUpdateModalProps) {
  const handleUpdate = async () => {
    await openPlayStore();
  };

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      onRequestClose={() => {}} // Android 뒤로가기 비활성화
    >
      <LinearGradient
        colors={['#121212', '#1A1A1A']}
        style={styles.container}
      >
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>🔄</Text>
          </View>
          
          <Text style={styles.title}>업데이트가 필요합니다</Text>
          
          <Text style={styles.message}>
            새로운 버전이 출시되었습니다.{'\n'}
            최신 버전으로 업데이트해주세요.
          </Text>
          
          <View style={styles.versionInfo}>
            <Text style={styles.versionText}>
              현재 버전: {currentVersion}
            </Text>
            <Text style={styles.versionText}>
              필요 버전: {requiredVersion}
            </Text>
          </View>
          
          <TouchableOpacity
            style={styles.updateButton}
            onPress={handleUpdate}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#42A5F5', '#1E88E5']}
              style={styles.updateButtonGradient}
            >
              <Text style={styles.updateButtonText}>
                {Platform.OS === 'android' ? 'Google Play에서 업데이트' : 'App Store에서 업데이트'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
          
          <Text style={styles.note}>
            업데이트 후 앱을 다시 실행해주세요.
          </Text>
        </View>
      </LinearGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 24,
  },
  icon: {
    fontSize: 64,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#B0B0B0',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  versionInfo: {
    width: '100%',
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  versionText: {
    fontSize: 14,
    color: '#E0E0E0',
    marginVertical: 4,
  },
  updateButton: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  updateButtonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  updateButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  note: {
    fontSize: 12,
    color: '#808080',
    textAlign: 'center',
  },
});











