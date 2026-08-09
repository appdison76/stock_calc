import { useAppOpenAdOncePerSession } from '../hooks/useAppOpenAdOncePerSession';

type Props = {
  /** AdMob 초기화·버전 체크 완료 후, 강제 업데이트가 아닐 때만 true */
  enabled: boolean;
};

/** UI 없음 — cold start 시 앱 오픈 광고 1회 표시 */
export function AppOpenAdController({ enabled }: Props) {
  useAppOpenAdOncePerSession(enabled);
  return null;
}
