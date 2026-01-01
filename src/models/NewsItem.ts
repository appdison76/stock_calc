export interface NewsItem {
  id: string;
  title: string;
  description: string;
  link: string;
  source: string; // "네이버 증권", "Yahoo Finance" 등
  publishedAt: Date;
  imageUrl?: string;
  relatedStockName?: string; // 관련 종목명 (필터링용)
  relatedTicker?: string; // 관련 티커 (필터링용)
}

