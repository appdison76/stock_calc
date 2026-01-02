import * as Application from 'expo-application';
import { Linking, Platform } from 'react-native';
import Constants from 'expo-constants';

// 최소 필수 버전 (이 버전보다 낮으면 강제 업데이트)
// TODO: 나중에 API 서버에서 가져오도록 변경 가능
// 1.1.0 버전 배포 시 1.0.9 이하 사용자들이 강제 업데이트 받도록 설정
const MIN_REQUIRED_VERSION = '1.1.0';

// Google Play Store URL (패키지명으로 변경 필요)
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.neovisioning.stockcalc';

export interface VersionInfo {
  currentVersion: string;
  minRequiredVersion: string;
  needsUpdate: boolean;
}

/**
 * 현재 앱 버전과 최소 필수 버전을 비교
 */
export function checkAppVersion(): VersionInfo {
  const currentVersion = Application.nativeApplicationVersion || Constants.expoConfig?.version || '1.0.0';
  
  const needsUpdate = compareVersions(currentVersion, MIN_REQUIRED_VERSION) < 0;

  return {
    currentVersion,
    minRequiredVersion: MIN_REQUIRED_VERSION,
    needsUpdate,
  };
}

/**
 * 버전 문자열 비교
 * @returns -1: v1 < v2, 0: v1 === v2, 1: v1 > v2
 */
function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  
  const maxLength = Math.max(parts1.length, parts2.length);
  
  for (let i = 0; i < maxLength; i++) {
    const part1 = parts1[i] || 0;
    const part2 = parts2[i] || 0;
    
    if (part1 < part2) return -1;
    if (part1 > part2) return 1;
  }
  
  return 0;
}

/**
 * Google Play Store로 리다이렉트
 */
export async function openPlayStore(): Promise<void> {
  const url = Platform.OS === 'android' 
    ? PLAY_STORE_URL
    : `https://apps.apple.com/app/id${Constants.expoConfig?.ios?.bundleIdentifier || ''}`;
  
  try {
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    }
  } catch (error) {
    console.error('Play Store 열기 실패:', error);
  }
}

/**
 * API에서 최소 필수 버전 가져오기 (선택적)
 * 나중에 서버 연동 시 사용
 */
export async function fetchMinRequiredVersion(): Promise<string> {
  try {
    // TODO: 실제 API 엔드포인트로 변경
    // const response = await fetch('https://your-api.com/api/min-version');
    // const data = await response.json();
    // return data.minVersion;
    
    return MIN_REQUIRED_VERSION;
  } catch (error) {
    console.error('최소 버전 가져오기 실패:', error);
    return MIN_REQUIRED_VERSION;
  }
}
















