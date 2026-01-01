/**
 * 네이버 검색 API를 사용한 뉴스 검색 서비스
 * 
 * 사용 방법:
 * 1. 네이버 개발자 센터(https://developers.naver.com/)에서 애플리케이션 등록
 * 2. Client ID와 Client Secret 발급
 * 3. 환경 변수 또는 설정에 API 키 저장
 */

import { NewsItem } from '../models/NewsItem';

// TODO: 네이버 개발자 센터에서 발급받은 API 키를 설정하세요
// 보안을 위해 환경 변수나 별도 설정 파일 사용 권장
const NAVER_CLIENT_ID = process.env.EXPO_PUBLIC_NAVER_CLIENT_ID || '';
const NAVER_CLIENT_SECRET = process.env.EXPO_PUBLIC_NAVER_CLIENT_SECRET || '';

const NAVER_SEARCH_API_URL = 'https://openapi.naver.com/v1/search/news.json';

interface NaverNewsItem {
  title: string;
  originallink: string;
  link: string;
  description: string;
  pubDate: string;
}

interface NaverSearchResponse {
  items: NaverNewsItem[];
  total: number;
  start: number;
  display: number;
}

/**
 * 네이버 검색 API를 사용하여 종목별 뉴스 검색
 * @param query 검색어 (종목명)
 * @param maxResults 최대 결과 수 (기본: 50, 최대: 100)
 * @returns NewsItem[]
 */
export async function searchStockNews(
  query: string,
  maxResults: number = 50
): Promise<NewsItem[]> {
  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
    console.warn('네이버 API 키가 설정되지 않았습니다. RSS 방식으로 대체합니다.');
    return [];
  }

  try {
    const searchQuery = encodeURIComponent(query);
    const url = `${NAVER_SEARCH_API_URL}?query=${searchQuery}&display=${Math.min(maxResults, 100)}&sort=date`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10초 타임아웃

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Naver-Client-Id': NAVER_CLIENT_ID,
        'X-Naver-Client-Secret': NAVER_CLIENT_SECRET,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('네이버 API 인증 실패: API 키를 확인하세요');
      } else if (response.status === 429) {
        throw new Error('네이버 API 호출 한도 초과: 월 25,000건 제한 확인');
      }
      throw new Error(`네이버 API 호출 실패: HTTP ${response.status}`);
    }

    const data: NaverSearchResponse = await response.json();

    if (!data.items || !Array.isArray(data.items)) {
      return [];
    }

    // NaverNewsItem을 NewsItem으로 변환
    const newsItems: NewsItem[] = data.items.map((item, index) => {
      // HTML 태그 제거 (네이버 API는 HTML 태그를 포함할 수 있음)
      const cleanTitle = item.title.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, '');
      const cleanDescription = item.description.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, '');

      // 날짜 파싱
      let publishedAt = new Date();
      try {
        publishedAt = new Date(item.pubDate);
        if (isNaN(publishedAt.getTime())) {
          publishedAt = new Date();
        }
      } catch (e) {
        publishedAt = new Date();
      }

      // 출처 추출 (originallink에서 도메인 추출)
      let source = '네이버 뉴스';
      try {
        const url = new URL(item.originallink || item.link);
        const hostname = url.hostname.replace('www.', '');
        if (hostname.includes('hani.co.kr')) source = '한겨레';
        else if (hostname.includes('hankyung.com')) source = '한국경제';
        else if (hostname.includes('mk.co.kr')) source = '매일경제';
        else if (hostname.includes('chosun.com')) source = '조선일보';
        else if (hostname.includes('joongang.co.kr')) source = '중앙일보';
        else if (hostname.includes('donga.com')) source = '동아일보';
        else if (hostname.includes('edaily.co.kr')) source = '이데일리';
        else if (hostname.includes('fnnews.com')) source = '파이낸셜뉴스';
        else if (hostname.includes('sedaily.com')) source = '서울경제';
        else source = hostname;
      } catch (e) {
        // URL 파싱 실패 시 기본값 사용
      }

      return {
        id: `naver_${query}_${index}_${Date.now()}`,
        title: cleanTitle,
        description: cleanDescription,
        link: item.link || item.originallink,
        source: source,
        publishedAt: publishedAt,
        imageUrl: undefined,
        relatedStocks: [query],
      };
    });

    console.log(`네이버 검색 API: "${query}" 검색 결과 ${newsItems.length}개`);
    return newsItems;
  } catch (error: any) {
    console.error('네이버 검색 API 오류:', error?.message || error);
    return [];
  }
}

/**
 * 네이버 검색 API 키가 설정되어 있는지 확인
 */
export function isNaverApiConfigured(): boolean {
  return !!(NAVER_CLIENT_ID && NAVER_CLIENT_SECRET);
}

