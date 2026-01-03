import * as Application from 'expo-application';
import { Linking, Platform } from 'react-native';
import Constants from 'expo-constants';

// GitHub Pages URL
const GITHUB_PAGES_URL = 'https://appdison76.github.io/stock_calc/min-version.json';

// Fallback 최소 필수 버전 (서버 접근 실패 시 사용)
const FALLBACK_MIN_REQUIRED_VERSION = '1.1.2';

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
export async function checkAppVersion(): Promise<VersionInfo> {
  const nativeVersion = Application.nativeApplicationVersion;
  const configVersion = Constants.expoConfig?.version;
  const currentVersion = nativeVersion || configVersion || '1.0.0';
  
  console.log('[Version Check] nativeApplicationVersion:', nativeVersion);
  console.log('[Version Check] expoConfig.version:', configVersion);
  console.log('[Version Check] currentVersion:', currentVersion);
  
  // 서버에서 최소 필수 버전 가져오기
  const minRequiredVersion = await fetchMinRequiredVersion();
  console.log('[Version Check] minRequiredVersion:', minRequiredVersion);
  
  const comparisonResult = compareVersions(currentVersion, minRequiredVersion);
  console.log('[Version Check] comparisonResult:', comparisonResult);
  const needsUpdate = comparisonResult < 0;
  console.log('[Version Check] needsUpdate:', needsUpdate);

  return {
    currentVersion,
    minRequiredVersion,
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
 * GitHub Pages에서 최소 필수 버전 가져오기
 */
export async function fetchMinRequiredVersion(): Promise<string> {
  try {
    console.log('[Version Check] Fetching min version from:', GITHUB_PAGES_URL);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5초 타임아웃

    const response = await fetch(GITHUB_PAGES_URL, {
      signal: controller.signal,
      headers: {
        'Cache-Control': 'no-cache',
      },
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      const minVersion = data.minRequiredVersion;
      console.log('[Version Check] Fetched min version from server:', minVersion);
      
      if (minVersion && typeof minVersion === 'string') {
        return minVersion;
      } else {
        console.warn('[Version Check] Invalid min version format, using fallback');
        return FALLBACK_MIN_REQUIRED_VERSION;
      }
    } else {
      console.warn('[Version Check] Failed to fetch min version, status:', response.status);
      return FALLBACK_MIN_REQUIRED_VERSION;
    }
  } catch (error) {
    console.error('[Version Check] Error fetching min version:', error);
    return FALLBACK_MIN_REQUIRED_VERSION;
  }
}
















