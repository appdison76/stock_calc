import React, { useRef, useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Alert, InteractionManager, Platform } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

interface ActionButton {
  icon?: string;
  label?: string;
  onPress: () => void;
  disabled?: boolean;
}

interface SharedResultSectionProps {
  children: React.ReactNode;
  watermarkText?: string;
  onTextShare?: () => void;
  actionButtons?: ActionButton[];
}

export const SharedResultSection: React.FC<SharedResultSectionProps> = ({
  children,
  watermarkText = '만든 사람: 네오비저닝',
  onTextShare,
  actionButtons = [],
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

  // 아이콘 매핑 (직관적인 아이콘)
  const getIcon = (icon?: string) => {
    const iconMap: Record<string, string> = {
      '📋': '📋', // 복사
      '🖼️': '📤', // 이미지 공유
      '🗑️': '❌', // 삭제 - X 표시
      '🔄': '🔄', // 초기화 - 큰 원형 화살표
      '↻': '🔄', // 초기화 - 큰 원형 화살표
      '💾': '💾', // 저장
    };
    return icon ? (iconMap[icon] || icon) : '';
  };

  // 버튼 스타일 매핑 (기능별 색상)
  const getButtonStyle = (icon?: string, label?: string) => {
    if (label) return null; // 텍스트 버튼은 별도 스타일 사용
    
    const styleMap: Record<string, any> = {
      '📋': { backgroundColor: 'rgba(66, 165, 245, 0.25)', borderColor: 'rgba(66, 165, 245, 0.4)' }, // 복사 - 파란색
      '🖼️': { backgroundColor: 'rgba(76, 175, 80, 0.25)', borderColor: 'rgba(76, 175, 80, 0.4)' }, // 공유 - 초록색
      '📤': { backgroundColor: 'rgba(76, 175, 80, 0.25)', borderColor: 'rgba(76, 175, 80, 0.4)' }, // 공유 - 초록색
      '🗑️': { backgroundColor: 'rgba(244, 67, 54, 0.3)', borderColor: 'rgba(244, 67, 54, 0.5)' }, // 삭제 - 빨간색 (더 진하게)
      '❌': { backgroundColor: 'rgba(244, 67, 54, 0.3)', borderColor: 'rgba(244, 67, 54, 0.5)' }, // 삭제 - 빨간색
      '✕': { backgroundColor: 'rgba(244, 67, 54, 0.3)', borderColor: 'rgba(244, 67, 54, 0.5)' }, // 삭제 - 빨간색 (작은 X)
      '🔄': { backgroundColor: 'rgba(255, 152, 0, 0.25)', borderColor: 'rgba(255, 152, 0, 0.4)' }, // 초기화 - 주황색
      '↻': { backgroundColor: 'rgba(255, 152, 0, 0.25)', borderColor: 'rgba(255, 152, 0, 0.4)' }, // 초기화 - 주황색
      '💾': { backgroundColor: 'rgba(156, 39, 176, 0.25)', borderColor: 'rgba(156, 39, 176, 0.4)' }, // 저장 - 보라색
    };
    
    const key = icon || '';
    return styleMap[key] || { backgroundColor: 'rgba(255, 255, 255, 0.15)', borderColor: 'rgba(255, 255, 255, 0.2)' };
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
              activeOpacity={0.6}
              style={styles.buttonWrapper}
            >
              <View style={[styles.shareButton, getButtonStyle('📋')]}>
                <Text style={styles.shareButtonIcon}>📋</Text>
              </View>
            </TouchableOpacity>
            <View style={styles.buttonSpacer} />
          </>
        )}
        <TouchableOpacity
          onPress={captureAndShare}
          disabled={isCapturing}
          activeOpacity={0.6}
          style={styles.buttonWrapper}
        >
          <View style={[styles.shareButton, getButtonStyle('📤')]}>
            {isCapturing ? (
              <Text style={styles.shareButtonIcon}>⋯</Text>
            ) : (
              <Text style={styles.shareButtonIcon}>📤</Text>
            )}
          </View>
        </TouchableOpacity>
        {actionButtons.map((action, index) => {
          const isLabelButton = !!action.label;
          const prevAction = index > 0 ? actionButtons[index - 1] : null;
          const needsExtraSpacing = isLabelButton && prevAction && !prevAction.label;
          
          return (
            <React.Fragment key={index}>
              {isLabelButton ? (
                <View style={styles.labelButtonSpacer} />
              ) : (
                <View style={styles.buttonSpacer} />
              )}
              <TouchableOpacity
                onPress={action.onPress}
                disabled={action.disabled}
                activeOpacity={0.6}
                style={[
                  styles.buttonWrapper,
                  isLabelButton && styles.labelButtonWrapper,
                ]}
              >
                {action.label ? (
                  <View style={[styles.shareButton, styles.labelButton]}>
                    <Text style={styles.shareButtonLabel}>{action.label}</Text>
                  </View>
                ) : (
                  <View style={[styles.shareButton, getButtonStyle(action.icon)]}>
                    {action.icon && <Text style={styles.shareButtonIcon}>{getIcon(action.icon)}</Text>}
                  </View>
                )}
              </TouchableOpacity>
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
  },
  contentView: {
    backgroundColor: 'transparent',
  },
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  buttonWrapper: {
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  labelButtonWrapper: {
    width: '100%',
    marginTop: 12,
  },
  shareButton: {
    minWidth: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  labelButton: {
    paddingHorizontal: 16,
    minWidth: 'auto',
    width: '100%',
    backgroundColor: 'rgba(76, 175, 80, 0.3)',
    borderColor: 'rgba(76, 175, 80, 0.5)',
  },
  shareButtonIcon: {
    fontSize: 20,
    textAlign: 'center',
    color: '#FFFFFF',
    fontWeight: '500',
  },
  shareButtonLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  buttonSpacer: {
    width: 8,
  },
  labelButtonSpacer: {
    width: 0,
  },
});

