import { Platform, type ColorValue } from 'react-native';

export type HeaderThemeId =
  | 'beige'
  | 'blueGray'
  | 'sage'
  | 'lavender'
  | 'rose'
  | 'slate'
  | 'cream'
  | 'mint'
  | 'sand'
  | 'pearl'
  | 'white';

export type HeaderTheme = {
  id: HeaderThemeId;
  label: string;
  background: string;
  border: string;
  shadow: string;
  buttonBg: string;
  buttonBorder: string;
};

/** 헤더 배경 프리셋 — DEFAULT_HEADER_THEME_ID 로 최종 선택 */
export const HEADER_THEMES: Record<HeaderThemeId, HeaderTheme> = {
  beige: {
    id: 'beige',
    label: '베이지',
    background: '#EDE8E0',
    border: 'rgba(60, 45, 30, 0.12)',
    shadow: '#3C2D1E',
    buttonBg: '#FFFFFF',
    buttonBorder: 'rgba(60, 45, 30, 0.1)',
  },
  blueGray: {
    id: 'blueGray',
    label: '블루그레이',
    background: '#E2EAF2',
    border: 'rgba(15, 23, 42, 0.12)',
    shadow: '#0F172A',
    buttonBg: '#FFFFFF',
    buttonBorder: 'rgba(15, 23, 42, 0.1)',
  },
  sage: {
    id: 'sage',
    label: '세이지',
    background: '#E4EBE4',
    border: 'rgba(40, 60, 45, 0.12)',
    shadow: '#2D4034',
    buttonBg: '#FFFFFF',
    buttonBorder: 'rgba(40, 60, 45, 0.1)',
  },
  lavender: {
    id: 'lavender',
    label: '라벤더',
    background: '#EBE6F2',
    border: 'rgba(55, 45, 75, 0.12)',
    shadow: '#3D3550',
    buttonBg: '#FFFFFF',
    buttonBorder: 'rgba(55, 45, 75, 0.1)',
  },
  rose: {
    id: 'rose',
    label: '로즈',
    background: '#F2E8E8',
    border: 'rgba(75, 45, 45, 0.12)',
    shadow: '#4A3030',
    buttonBg: '#FFFFFF',
    buttonBorder: 'rgba(75, 45, 45, 0.1)',
  },
  slate: {
    id: 'slate',
    label: '슬레이트',
    background: '#E4E7EC',
    border: 'rgba(30, 41, 59, 0.12)',
    shadow: '#1E293B',
    buttonBg: '#FFFFFF',
    buttonBorder: 'rgba(30, 41, 59, 0.1)',
  },
  cream: {
    id: 'cream',
    label: '크림',
    background: '#F5F0E6',
    border: 'rgba(70, 55, 35, 0.1)',
    shadow: '#4A4030',
    buttonBg: '#FFFFFF',
    buttonBorder: 'rgba(70, 55, 35, 0.08)',
  },
  mint: {
    id: 'mint',
    label: '민트',
    background: '#E6F2EF',
    border: 'rgba(30, 70, 60, 0.12)',
    shadow: '#2A5048',
    buttonBg: '#FFFFFF',
    buttonBorder: 'rgba(30, 70, 60, 0.1)',
  },
  sand: {
    id: 'sand',
    label: '샌드',
    background: '#E8DFD0',
    border: 'rgba(80, 60, 40, 0.14)',
    shadow: '#504030',
    buttonBg: '#FFFFFF',
    buttonBorder: 'rgba(80, 60, 40, 0.12)',
  },
  pearl: {
    id: 'pearl',
    label: '펄',
    background: '#F0F2F5',
    border: 'rgba(20, 30, 45, 0.1)',
    shadow: '#1A2433',
    buttonBg: '#FFFFFF',
    buttonBorder: 'rgba(20, 30, 45, 0.08)',
  },
  white: {
    id: 'white',
    label: '화이트',
    background: '#FFFFFF',
    border: 'rgba(0, 0, 0, 0.08)',
    shadow: '#000000',
    buttonBg: '#F5F5F5',
    buttonBorder: 'rgba(0, 0, 0, 0.08)',
  },
};

export const DEFAULT_HEADER_THEME_ID: HeaderThemeId = 'white';

/** 메인 화면 배경 그radient #1 — 흰 헤더 → 짧은 세로 페이드 → 다크 본문 */
export const MAIN_SCREEN_GRADIENT_1 = {
  colors: [
    '#EEEEEE',
    '#AAAAAA',
    '#555555',
    '#282828',
    '#181818',
    '#121212',
    '#0D0D0D',
  ] as const,
  locations: [0.075, 0.095, 0.11, 0.125, 0.14, 0.155, 1] as const,
  start: { x: 0, y: 0 } as const,
  end: { x: 0, y: 1 } as const,
};

export function getMainScreenGradient(theme: HeaderTheme) {
  const top = theme.background;
  return {
    colors: [top, top, ...MAIN_SCREEN_GRADIENT_1.colors] as [
      ColorValue,
      ColorValue,
      ...ColorValue[],
    ],
    locations: [0, 0.05, ...MAIN_SCREEN_GRADIENT_1.locations] as [number, number, ...number[]],
    start: MAIN_SCREEN_GRADIENT_1.start,
    end: MAIN_SCREEN_GRADIENT_1.end,
  };
}

export function getHeaderThemeStyles(theme: HeaderTheme) {
  const buttonShadow = Platform.select({
    ios: {
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 3,
    },
    android: {
      elevation: 1,
    },
  });

  return {
    topHeader: {
      backgroundColor: 'transparent',
      borderBottomWidth: 0,
    },
    headerButton: {
      backgroundColor: theme.buttonBg,
      borderColor: theme.buttonBorder,
      ...buttonShadow,
    },
  };
}
