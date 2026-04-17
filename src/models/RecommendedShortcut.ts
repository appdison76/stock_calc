/** 관리자(Firestore)가 제공하는 메인 추천 바로가기 (앱에서는 읽기만) */
export interface RecommendedShortcut {
  id: string;
  title: string;
  url: string;
  /** 비어 있으면 URL 기준으로 유튜브는 📺, 그 외 🔗 */
  iconEmoji?: string;
}
