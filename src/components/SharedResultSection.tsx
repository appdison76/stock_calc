import React, { useRef, useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Alert, InteractionManager, Platform } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

interface SharedResultSectionProps {
  children: React.ReactNode;
  watermarkText?: string;
  onTextShare?: () => void;
}

export const SharedResultSection: React.FC<SharedResultSectionProps> = ({
  children,
  watermarkText = '만든 사람: 네오비저닝',
  onTextShare,
}) => {
  const viewRef = useRef<View | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isLayoutReady, setIsLayoutReady] = useState(false);

  const captureAndShare = async () => {
    if (!viewRef.current) {
      Alert.alert('오류', '공유할 콘텐츠를 찾을 수 없습니다.');
      return;
    }

    if (!isLayoutReady) {
      Alert.alert('알림', '레이아웃이 준비되지 않았습니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    setIsCapturing(true);

    try {
      // 모든 인터랙션이 완료된 후 캡처 시작
      const interactionPromise = new Promise<void>((resolve) => {
        InteractionManager.runAfterInteractions(() => {
          resolve();
        });
      });

      await interactionPromise;

      // 추가 지연 시간 (레이아웃 완료 보장 및 네이티브 뷰 준비)
      await new Promise(resolve => setTimeout(resolve, 500));

      console.log('이미지 캡처 시작...');
      
      const uri = await captureRef(viewRef.current, {
        format: 'png',
        quality: 0.9,
        result: 'tmpfile', // 임시 파일로 저장
      });

      console.log('이미지 캡처 완료:', uri);

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        console.log('공유 시작...');
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: '주식 계산 결과',
        });
        console.log('공유 완료');
      } else {
        Alert.alert('공유 불가', '이 기기에서 공유 기능을 사용할 수 없습니다.');
      }
    } catch (e) {
      console.error('이미지 공유에 실패했습니다:', e);
      const errorMessage = e instanceof Error ? e.message : String(e);
      Alert.alert('오류', `이미지 공유에 실패했습니다: ${errorMessage}`);
    } finally {
      setIsCapturing(false);
    }
  };

  const handleLayout = () => {
    setIsLayoutReady(true);
  };

  return (
    <View style={styles.container}>
      <View 
        ref={viewRef}
        collapsable={false}
        onLayout={handleLayout}
        style={styles.contentView}
      >
        {children}
      </View>
      <View style={styles.buttonContainer}>
        {onTextShare && (
          <>
            <TouchableOpacity
              onPress={onTextShare}
              style={[styles.shareButton, styles.textShareButton]}
              activeOpacity={0.7}
            >
              <Text style={styles.shareButtonIcon}>📋</Text>
            </TouchableOpacity>
            <View style={styles.buttonSpacer} />
          </>
        )}
        <TouchableOpacity
          onPress={captureAndShare}
          disabled={isCapturing}
          style={[styles.shareButton, styles.imageShareButton]}
          activeOpacity={0.7}
        >
          {isCapturing ? (
            <Text style={styles.shareButtonIcon}>⏳</Text>
          ) : (
            <Text style={styles.shareButtonIcon}>🖼️</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  contentView: {
    backgroundColor: 'transparent',
  },
  buttonContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
  },
  shareButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  textShareButton: {
    backgroundColor: 'rgba(76, 175, 80, 0.9)',
  },
  imageShareButton: {
    backgroundColor: 'rgba(33, 150, 243, 0.9)',
  },
  shareButtonIcon: {
    fontSize: 22,
  },
  buttonSpacer: {
    width: 8,
  },
});

