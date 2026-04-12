/** 메인「나만의 바로가기」 및 관리 화면에서 쓰는 사용자 바로가기 */
export interface MyShortcut {
  id: string;
  title: string;
  url: string;
  /** 비어 있으면 URL 기준 추천(유튜브 📺, 그 외 🔗) */
  iconEmoji: string;
  showOnMain: boolean;
  sortOrder: number;
  /** 삭제 불가(앱 기본 제공) */
  isDefault: boolean;
}
