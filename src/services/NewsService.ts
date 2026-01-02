import { XMLParser } from 'fast-xml-parser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NewsItem } from '../models/NewsItem';
import { Currency } from '../models/Currency';
import { searchStockNews as searchNaverStockNews, isNaverApiConfigured } from './NaverSearchService';
import { US_ETF_TO_UNDERLYING_MAP } from '../data/us_etf_underlying_map';

const CACHE_KEY_GENERAL_NEWS = '@news_general';
const CACHE_KEY_STOCK_NEWS = '@news_stock_';
const CACHE_DURATION = 30 * 60 * 1000; // 30분

interface CacheData {
  news: NewsItem[];
  timestamp: number;
}

/**
 * 한국 주식 뉴스 RSS 피드에서 뉴스 가져오기 (여러 소스 시도)
 */
async function fetchNaverFinanceRSS(): Promise<NewsItem[]> {
  // 여러 RSS 소스를 시도 (주요 신문사들의 주식/증권 RSS)
  // 작동하는 RSS 소스만 포함 (404나 HTML 오류가 발생하는 소스는 제거)
  const rssSources = [
    // 한겨레 (확실히 작동함)
    {
      url: 'https://www.hani.co.kr/rss/economy/',
      name: '한겨레 경제',
    },
    // 한국경제 - 다른 URL 패턴 시도
    {
      url: 'https://www.hankyung.com/rss/economy.xml',
      name: '한국경제',
    },
    {
      url: 'https://www.hankyung.com/rss/',
      name: '한국경제 전체',
    },
    // 매일경제 - 여러 카테고리 시도
    {
      url: 'https://www.mk.co.kr/rss/30000041/',
      name: '매일경제',
    },
    {
      url: 'https://www.mk.co.kr/rss/30000042/',
      name: '매일경제 증권',
    },
    {
      url: 'https://www.mk.co.kr/rss/',
      name: '매일경제 전체',
    },
    // 추가 소스들 시도
    {
      url: 'https://www.edaily.co.kr/rss/news.xml',
      name: '이데일리',
    },
    {
      url: 'https://www.fnnews.com/rss/rss.xml',
      name: '파이낸셜뉴스',
    },
    {
      url: 'https://www.sedaily.com/rss/news.xml',
      name: '서울경제',
    },
    {
      url: 'https://rss.joins.com/joins_economy_list.xml',
      name: '중앙일보 경제',
    },
  ];

  const allNews: NewsItem[] = [];

  // 각 소스에서 뉴스 가져오기 (병렬 처리로 속도 향상)
  const promises = rssSources.map(source => 
    fetchRSSFromSource(source.url, source.name).catch(error => {
      console.warn(`${source.name} RSS 가져오기 실패:`, error);
      return []; // 실패 시 빈 배열 반환
    })
  );

  const results = await Promise.all(promises);
  results.forEach(news => {
    allNews.push(...news);
  });

  // 중복 제거 (제목 기준)
  const uniqueNews = allNews.filter((news, index, self) =>
    index === self.findIndex((n) => n.title === news.title)
  );

  // 날짜순 정렬 (최신순)
  uniqueNews.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

  console.log(`총 ${uniqueNews.length}개 뉴스 항목 수집 완료 (${rssSources.length}개 소스 중 ${results.filter(r => r.length > 0).length}개 성공)`);
  return uniqueNews;
}

/**
 * 특정 RSS 소스에서 뉴스 가져오기
 */
async function fetchRSSFromSource(url: string, sourceName: string): Promise<NewsItem[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10초 타임아웃
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      },
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const xmlText = await response.text();
    
    if (!xmlText || xmlText.trim().length === 0) {
      throw new Error('응답이 비어있습니다');
    }

    // HTML 오류 페이지인지 확인
    if (xmlText.includes('<!DOCTYPE html>') || 
        xmlText.includes('<html') ||
        xmlText.includes('잘못된 접근')) {
      throw new Error('HTML 오류 페이지를 받았습니다');
    }

    // XML이 아닌 경우도 확인
    if (!xmlText.trim().startsWith('<?xml') && !xmlText.trim().startsWith('<rss')) {
      throw new Error('유효한 XML이 아닙니다');
    }

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
      parseAttributeValue: true,
      parseTrueNumberOnly: false,
    });

    const result = parser.parse(xmlText);
    
    // RSS 구조 확인 (다양한 형식 지원)
    const items = result.rss?.channel?.item || 
                  result.feed?.entry || 
                  result.channel?.item || 
                  [];
    
    if (!Array.isArray(items)) {
      throw new Error('RSS items가 배열이 아닙니다');
    }
    
    console.log(`${sourceName} RSS에서 ${items.length}개 항목 발견`);
    
    // 소스명을 포함하여 파싱
    return parseRSSItems(items, sourceName);
  } catch (error: any) {
    // 오류를 조용히 처리 (404 등은 정상적인 상황일 수 있음)
    // 개발 중에만 로그 출력
    if (__DEV__) {
      console.warn(`${sourceName} RSS 가져오기 실패 (무시됨):`, error?.message || error);
    }
    return [];
  }
}

/**
 * RSS items 파싱 헬퍼 함수
 */
function parseRSSItems(items: any[], sourceName: string = '주식 뉴스'): NewsItem[] {
  return items.map((item: any, index: number) => {
      // RSS 형식에 맞게 파싱 (다양한 형식 지원)
      let title = '';
      let description = '';
      let link = '';
      let pubDate = '';

      // title 파싱 (여러 형식 지원)
      if (typeof item.title === 'string') {
        title = item.title;
      } else if (item.title?.['#text']) {
        title = item.title['#text'];
      } else if (item.title?.['?xml']?.['#text']) {
        title = item.title['?xml']['#text'];
      }

      // description 파싱
      if (typeof item.description === 'string') {
        description = item.description;
      } else if (item.description?.['#text']) {
        description = item.description['#text'];
      } else if (item['content:encoded']) {
        description = item['content:encoded'];
      } else if (item['content']) {
        description = typeof item['content'] === 'string' ? item['content'] : item['content']['#text'] || '';
      }

      // link 파싱
      if (typeof item.link === 'string') {
        link = item.link;
      } else if (item.link?.['#text']) {
        link = item.link['#text'];
      } else if (item.guid) {
        link = typeof item.guid === 'string' ? item.guid : (item.guid['#text'] || item.guid['@_isPermaLink'] || '');
      } else if (item.id) {
        link = typeof item.id === 'string' ? item.id : item.id['#text'] || '';
      }

      // pubDate 파싱
      if (typeof item.pubDate === 'string') {
        pubDate = item.pubDate;
      } else if (item.pubDate?.['#text']) {
        pubDate = item.pubDate['#text'];
      } else if (item.published) {
        pubDate = typeof item.published === 'string' ? item.published : item.published['#text'] || '';
      } else if (item.updated) {
        pubDate = typeof item.updated === 'string' ? item.updated : item.updated['#text'] || '';
      }

      // HTML 태그 제거
      const cleanDescription = description
        .replace(/<[^>]*>/g, '') // HTML 태그 제거
        .replace(/&nbsp;/g, ' ') // &nbsp;를 공백으로
        .replace(/&amp;/g, '&') // &amp;를 &로
        .replace(/&lt;/g, '<') // &lt;를 <로
        .replace(/&gt;/g, '>') // &gt;를 >로
        .replace(/&quot;/g, '"') // &quot;를 "로
        .replace(/&#39;/g, "'") // &#39;를 '로
        .trim()
        .substring(0, 200); // 최대 200자로 제한

      return {
        id: `${sourceName}_${Date.now()}_${index}`,
        title: title.trim() || '제목 없음',
        description: cleanDescription || '',
        link: link.trim() || '',
        source: sourceName,
        publishedAt: pubDate ? parseDate(pubDate) : new Date(),
        relatedStockName: undefined,
      };
    });
}

/**
 * Yahoo Finance News API에서 뉴스 가져오기
 */
async function fetchYahooFinanceNews(ticker: string): Promise<NewsItem[]> {
  try {
    // Yahoo Finance Search API 사용
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(ticker)}&quotesCount=0&newsCount=20`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const newsItems = data.news?.results || [];
    
    if (!Array.isArray(newsItems)) {
      return [];
    }

    return newsItems.map((item: any, index: number) => {
      return {
        id: `yahoo_${Date.now()}_${index}`,
        title: item.title || '',
        description: item.summary || '',
        link: item.link || '',
        source: item.publisher || 'Yahoo Finance',
        publishedAt: new Date((item.providerPublishTime || item.publishTime || Date.now()) * 1000),
        imageUrl: item.thumbnail?.resolutions?.[0]?.url,
        relatedTicker: ticker,
      };
    });
  } catch (error) {
    console.error('Yahoo Finance News API 오류:', error);
    return [];
  }
}

/**
 * 날짜 문자열 파싱
 */
function parseDate(dateString: string): Date {
  try {
    // RFC 822 형식 (예: "Wed, 01 Jan 2024 12:00:00 +0900")
    const parsed = new Date(dateString);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
    return new Date();
  } catch {
    return new Date();
  }
}

/**
 * 캐시에서 뉴스 가져오기
 */
async function getCachedNews(cacheKey: string): Promise<NewsItem[] | null> {
  try {
    const cached = await AsyncStorage.getItem(cacheKey);
    if (!cached) return null;

    const cacheData: CacheData = JSON.parse(cached);
    const now = Date.now();

    // 캐시가 만료되지 않았으면 반환
    if (now - cacheData.timestamp < CACHE_DURATION) {
      // Date 객체로 변환
      return cacheData.news.map(item => ({
        ...item,
        publishedAt: new Date(item.publishedAt),
      }));
    }

    return null;
  } catch (error) {
    console.error('캐시 읽기 오류:', error);
    return null;
  }
}

/**
 * 뉴스 캐시에 저장
 */
async function setCachedNews(cacheKey: string, news: NewsItem[]): Promise<void> {
  try {
    const cacheData: CacheData = {
      news,
      timestamp: Date.now(),
    };
    await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheData));
  } catch (error) {
    console.error('캐시 저장 오류:', error);
  }
}

/**
 * 전체 주식 뉴스 가져오기 (구글 뉴스 RSS 사용)
 * @param searchQuery 검색어 (선택, 없으면 전체 주식 뉴스)
 * @param forceRefresh 강제 새로고침
 * @param daysBack 가져올 뉴스의 기간 (일수, 기본: 7일)
 */
export async function fetchGeneralNews(forceRefresh: boolean = false, searchQuery?: string, daysBack: number = 7, language: 'ko' | 'en' = 'ko'): Promise<NewsItem[]> {
  const cacheKey = searchQuery
    ? `${CACHE_KEY_GENERAL_NEWS}_search_${searchQuery}_${daysBack}_${language}`
    : `${CACHE_KEY_GENERAL_NEWS}_${daysBack}_${language}`;

  // 강제 새로고침이 아니면 캐시 확인
  if (!forceRefresh) {
    const cached = await getCachedNews(cacheKey);
    if (cached) {
      return cached;
    }
  }

  try {
    // 여러 키워드로 검색하여 더 많은 뉴스 수집
    const keywords = searchQuery 
      ? [searchQuery]
      : language === 'en'
      ? [
          'stock',
          'stocks',
          'stock market',
          'trading',
          'investment',
          'finance',
          'nasdaq',
          's&p 500'
        ]
      : [
          '주식', 
          '증권', 
          '코스피', 
          '코스닥', 
          '종목',
          '투자',
          '주가',
          '시장'
        ];
    
    console.log(`구글 뉴스 RSS로 ${searchQuery ? `검색: "${searchQuery}"` : '전체 주식 뉴스'} 수집 (${keywords.length}개 키워드)`);
    
    // 여러 키워드로 병렬 검색
    const searchPromises = keywords.map(async (keyword) => {
      const query = encodeURIComponent(keyword);
      // daysBack에 따라 시간 범위 설정 (구글 뉴스는 1d, 7d, 30d, 365d 등 지원)
      let whenParam = '7d';
      if (daysBack >= 365) whenParam = '365d';
      else if (daysBack >= 30) whenParam = '30d';
      else if (daysBack >= 7) whenParam = '7d';
      else whenParam = '1d';
      
      // 언어에 따라 URL 파라미터 설정
      const hl = language === 'en' ? 'en' : 'ko';
      const gl = language === 'en' ? 'US' : 'KR';
      const ceid = language === 'en' ? 'US:en' : 'KR:ko';
      const url = `https://news.google.com/rss/search?q=${query}&hl=${hl}&gl=${gl}&ceid=${ceid}&when=${whenParam}`;
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const xmlText = await response.text();
        
        if (!xmlText || xmlText.trim().length === 0) {
          return [];
        }
        
        const parser = new XMLParser({
          ignoreAttributes: false,
          attributeNamePrefix: '@_',
          textNodeName: '#text',
          parseAttributeValue: true,
          parseTrueNumberOnly: false,
        });
        
        const result = parser.parse(xmlText);
        const items = result.rss?.channel?.item || [];
        
        if (!Array.isArray(items)) {
          return [];
        }
        
        // 구글 뉴스 RSS 항목을 NewsItem으로 변환
        return items.map((item: any, index: number) => {
          let title = '';
          let description = '';
          let link = '';
          let pubDate = '';
          let source = '구글 뉴스';
          
          // title 파싱
          if (typeof item.title === 'string') {
            title = item.title;
          } else if (item.title?.['#text']) {
            title = item.title['#text'];
          }
          
          // description 파싱
          if (typeof item.description === 'string') {
            description = item.description;
          } else if (item.description?.['#text']) {
            description = item.description['#text'];
          }
          
          // link 파싱
          if (typeof item.link === 'string') {
            link = item.link;
          } else if (item.link?.['#text']) {
            link = item.link['#text'];
          }
          
          // pubDate 파싱
          if (typeof item.pubDate === 'string') {
            pubDate = item.pubDate;
          } else if (item.pubDate?.['#text']) {
            pubDate = item.pubDate['#text'];
          }
          
          // source 파싱
          if (item.source) {
            if (typeof item.source === 'string') {
              source = item.source;
            } else if (item.source?.['#text']) {
              source = item.source['#text'];
            } else if (item.source?.['@_url']) {
              try {
                const url = new URL(item.source['@_url']);
                source = url.hostname.replace('www.', '');
              } catch (e) {
                // URL 파싱 실패 시 기본값 사용
              }
            }
          }
          
          // HTML 태그 제거
          title = title.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, '');
          description = description.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, '');
          
          // 날짜 파싱
          let publishedAt = new Date();
          try {
            publishedAt = new Date(pubDate);
            if (isNaN(publishedAt.getTime())) {
              publishedAt = new Date();
            }
          } catch (e) {
            publishedAt = new Date();
          }
          
          return {
            id: `google_${keyword}_${index}_${Date.now()}_${Math.random()}`,
            title: title,
            description: description,
            link: link,
            source: source,
            publishedAt: publishedAt,
            imageUrl: undefined,
          };
        });
      } catch (error) {
        console.warn(`키워드 "${keyword}" 검색 실패:`, error);
        return [];
      }
    });
    
    // 모든 검색 결과 수집
    const results = await Promise.all(searchPromises);
    let allNews: NewsItem[] = [];
    results.forEach(news => {
      allNews.push(...news);
    });
    
    // 중복 제거 (제목 기준)
    const uniqueNews = allNews.filter((news, index, self) =>
      index === self.findIndex((n) => n.title === news.title && n.link === news.link)
    );
    
    // 날짜순 정렬 (최신순)
    uniqueNews.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
    
    console.log(`구글 뉴스 RSS 전체 뉴스 파싱 완료: ${uniqueNews.length}개 (중복 제거 후)`);
    
    // 캐시에 저장
    if (uniqueNews.length > 0) {
      await setCachedNews(cacheKey, uniqueNews);
    }
    
    return uniqueNews;
  } catch (error: any) {
    console.warn(`구글 뉴스 RSS 전체 뉴스 가져오기 실패, 기존 RSS로 대체:`, error?.message || error);
    // 실패 시 기존 방식으로 대체
    const news = await fetchNaverFinanceRSS();
    
    if (news.length > 0) {
      await setCachedNews(cacheKey, news);
    }
    
    return news;
  }
}

/**
 * 구글 뉴스 RSS로 종목별 뉴스 검색 (무료, API 키 불필요)
 */
export async function fetchGoogleNewsRSS(
  searchTerm: string,
  stockName: string | undefined,
  ticker: string,
  language: 'ko' | 'en' = 'ko',
  daysBack: number = 7
): Promise<NewsItem[]> {
  try {
    // 구글 뉴스 RSS URL: 언어별 검색
    let query: string;
    let url: string;
    
    // daysBack에 따라 시간 범위 설정
    let whenParam = '7d';
    if (daysBack >= 365) whenParam = '365d';
    else if (daysBack >= 30) whenParam = '30d';
    else if (daysBack >= 7) whenParam = '7d';
    else whenParam = '1d';
    
    if (language === 'en') {
      // 영어 검색 (미국 주식)
      query = encodeURIComponent(`${searchTerm} stock`);
      url = `https://news.google.com/rss/search?q=${query}&hl=en&gl=US&ceid=US:en&when=${whenParam}`;
    } else {
      // 한국어 검색 (한국 주식)
      query = encodeURIComponent(`${searchTerm} 주식`);
      url = `https://news.google.com/rss/search?q=${query}&hl=ko&gl=KR&ceid=KR:ko&when=${whenParam}`;
    }
    
    console.log(`구글 뉴스 RSS 검색: "${searchTerm}" (${language}, ${whenParam})`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15초 타임아웃
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const xmlText = await response.text();
    
    if (!xmlText || xmlText.trim().length === 0) {
      throw new Error('응답이 비어있습니다');
    }
    
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
      parseAttributeValue: true,
      parseTrueNumberOnly: false,
    });
    
    const result = parser.parse(xmlText);
    const items = result.rss?.channel?.item || [];
    
    if (!Array.isArray(items)) {
      throw new Error('RSS items가 배열이 아닙니다');
    }
    
    console.log(`구글 뉴스 RSS에서 ${items.length}개 항목 발견`);
    
    // 구글 뉴스 RSS 항목을 NewsItem으로 변환
    const newsItems: NewsItem[] = items.map((item: any, index: number) => {
      let title = '';
      let description = '';
      let link = '';
      let pubDate = '';
      let source = '구글 뉴스';
      
      // title 파싱
      if (typeof item.title === 'string') {
        title = item.title;
      } else if (item.title?.['#text']) {
        title = item.title['#text'];
      }
      
      // description 파싱
      if (typeof item.description === 'string') {
        description = item.description;
      } else if (item.description?.['#text']) {
        description = item.description['#text'];
      }
      
      // link 파싱
      if (typeof item.link === 'string') {
        link = item.link;
      } else if (item.link?.['#text']) {
        link = item.link['#text'];
      }
      
      // pubDate 파싱
      if (typeof item.pubDate === 'string') {
        pubDate = item.pubDate;
      } else if (item.pubDate?.['#text']) {
        pubDate = item.pubDate['#text'];
      }
      
      // source 파싱 (구글 뉴스는 source 태그에 언론사 정보가 있을 수 있음)
      if (item.source) {
        if (typeof item.source === 'string') {
          source = item.source;
        } else if (item.source?.['#text']) {
          source = item.source['#text'];
        } else if (item.source?.['@_url']) {
          // URL에서 도메인 추출
          try {
            const url = new URL(item.source['@_url']);
            source = url.hostname.replace('www.', '');
          } catch (e) {
            // URL 파싱 실패 시 기본값 사용
          }
        }
      }
      
      // HTML 태그 제거
      title = title.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, '');
      description = description.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, '');
      
      // 날짜 파싱
      let publishedAt = new Date();
      try {
        publishedAt = new Date(pubDate);
        if (isNaN(publishedAt.getTime())) {
          publishedAt = new Date();
        }
      } catch (e) {
        publishedAt = new Date();
      }
      
      return {
        id: `google_${ticker}_${index}_${Date.now()}`,
        title: title,
        description: description,
        link: link,
        source: source,
        publishedAt: publishedAt,
        imageUrl: undefined,
        relatedStocks: [searchTerm],
      };
    });
    
    console.log(`구글 뉴스 RSS 파싱 완료: ${newsItems.length}개`);
    return newsItems;
  } catch (error: any) {
    console.warn(`구글 뉴스 RSS 가져오기 실패:`, error?.message || error);
    return [];
  }
}

/**
 * RSS 방식으로 종목별 뉴스 필터링 (백업용, 구글 뉴스 실패 시 사용)
 */
async function fetchStockNewsFromRSS(
  searchTerm: string,
  stockName: string | undefined,
  ticker: string
): Promise<NewsItem[]> {
  try {
    const allNews = await fetchGeneralNews();
    
    // 종목명으로 필터링 (제목 또는 설명에 포함)
    // 검색어를 여러 형태로 시도: 원본, 공백 제거, 괄호 제거
    const searchTerms = [
      searchTerm,
      searchTerm.replace(/\s+/g, ''), // 공백 제거
      searchTerm.replace(/\([^)]*\)/g, '').trim(), // 괄호와 내용 제거 (예: "삼성전자(005930)" -> "삼성전자")
      searchTerm.split('(')[0].trim(), // 괄호 앞부분만
    ].filter(term => term.length > 0);
    
    console.log(`RSS 필터링 검색어 변형: ${JSON.stringify(searchTerms)} (원본: ${searchTerm})`);
    console.log(`전체 뉴스 수: ${allNews.length}`);
    
    // 종목별 뉴스는 항상 필터링 수행 (관련 뉴스만 표시)
    let news = allNews.filter(item => {
      const titleLower = item.title.toLowerCase();
      const descLower = item.description.toLowerCase();
      
      // 정확한 매칭 시도
      const exactMatch = searchTerms.some(term => {
        const termLower = term.toLowerCase();
        return titleLower.includes(termLower) || descLower.includes(termLower);
      });
      
      if (exactMatch) return true;
      
      // 뉴스가 적을 때는 부분 매칭도 시도 (예: "삼성전자" -> "삼성" 또는 "전자")
      if (allNews.length < 150 && searchTerm.length >= 4) {
        const midPoint = Math.floor(searchTerm.length / 2);
        const partialTerms = [
          searchTerm.substring(0, midPoint), // 앞부분 (예: "삼성")
          searchTerm.substring(midPoint), // 뒷부분 (예: "전자")
        ].filter(t => t.length >= 2);
        
        return partialTerms.some(term => {
          const termLower = term.toLowerCase();
          return titleLower.includes(termLower) || descLower.includes(termLower);
        });
      }
      
      return false;
    });
    
    console.log(`RSS 필터링 결과: ${news.length}개 (전체 ${allNews.length}개 중, 검색어: "${searchTerm}")`);
    
    // 관련 종목명 정보 추가
    news = news.map(item => ({
      ...item,
      relatedStockName: stockName,
      relatedTicker: ticker,
    }));
    
    return news;
  } catch (error) {
    // 필터링 실패 시 빈 배열 반환 (조용히 처리)
    if (__DEV__) {
      console.warn('종목별 뉴스 필터링 실패:', error);
    }
    return [];
  }
}

/**
 * 종목별 뉴스 가져오기
 */
export async function fetchStockNews(
  ticker: string,
  stockName: string | undefined,
  currency: Currency,
  forceRefresh: boolean = false,
  daysBack: number = 7
): Promise<NewsItem[]> {
  const cacheKey = `${CACHE_KEY_STOCK_NEWS}${ticker}_${currency}`;

  // 강제 새로고침이 아니면 캐시 확인
  if (!forceRefresh) {
    const cached = await getCachedNews(cacheKey);
    if (cached) {
      return cached;
    }
  }

  let news: NewsItem[] = [];

  // ticker를 기반으로 한국 주식인지 판단 (포트폴리오 currency와 무관)
  // .KS 또는 .KQ로 끝나면 한국 주식, 그 외는 외국 주식
  const isKoreanStock = ticker.endsWith('.KS') || ticker.endsWith('.KQ');
  const isForeignStock = !isKoreanStock;

  if (isForeignStock) {
    // 외국 종목: 구글 뉴스 RSS (영어 검색) 우선, 실패 시 Yahoo Finance
    const searchTerm = stockName || ticker;
    
    if (!searchTerm) {
      return [];
    }

    // ETF인 경우 기초 자산 티커 확인
    const underlyingTicker = US_ETF_TO_UNDERLYING_MAP[ticker];
    const isETF = !!underlyingTicker && underlyingTicker !== ticker;

    try {
      // 1순위: 구글 뉴스 RSS (영어 검색)
      news = await fetchGoogleNewsRSS(searchTerm, stockName, ticker, 'en', daysBack);
      
      if (news.length === 0) {
        // 구글 뉴스가 없으면 Yahoo Finance 시도
        console.log(`구글 뉴스 없음, Yahoo Finance로 시도: "${ticker}"`);
        news = await fetchYahooFinanceNews(ticker);
      } else {
        console.log(`구글 뉴스 RSS로 ${news.length}개 뉴스 수집`);
      }
      
      // 관련 종목명 정보 추가
      news = news.map(item => ({
        ...item,
        relatedStockName: stockName,
        relatedTicker: ticker,
      }));

      // ETF인 경우 기초 자산 뉴스도 가져오기
      if (isETF) {
        try {
          const underlyingNews = await fetchGoogleNewsRSS(underlyingTicker, underlyingTicker, underlyingTicker, 'en', daysBack);
          
          // ETF 뉴스와 기초 자산 뉴스 합치기 (중복 제거)
          const baseTitles = new Set(news.map(n => n.title));
          const uniqueUnderlyingNews = underlyingNews.filter(item => !baseTitles.has(item.title));
          
          news = [...news, ...uniqueUnderlyingNews];
          
          console.log(`ETF ${ticker} -> 기초자산 ${underlyingTicker}: 총 ${news.length}개 뉴스 (ETF ${news.length - uniqueUnderlyingNews.length}개 + 기초자산 ${uniqueUnderlyingNews.length}개)`);
        } catch (error) {
          console.warn(`기초 자산 ${underlyingTicker} 뉴스 로드 실패:`, error);
          // 기초 자산 뉴스 로드 실패해도 ETF 뉴스는 유지
        }
      }
    } catch (error) {
      console.warn('미국 종목 뉴스 검색 실패, Yahoo Finance로 시도:', error);
      // 실패 시 Yahoo Finance 시도
      try {
        news = await fetchYahooFinanceNews(ticker);
        news = news.map(item => ({
          ...item,
          relatedStockName: stockName,
          relatedTicker: ticker,
        }));
      } catch (yahooError) {
        console.error('Yahoo Finance도 실패:', yahooError);
        news = [];
      }
    }

    // 시간순 정렬 (최신 뉴스가 맨 위)
    news.sort((a, b) => {
      const dateA = a.publishedAt.getTime();
      const dateB = b.publishedAt.getTime();
      return dateB - dateA; // 내림차순 (최신이 먼저)
    });
  } else if (isKoreanStock) {
    // 한국 종목: 구글 뉴스 RSS (한국어 검색)
    const searchTerm = stockName || ticker;
    
    if (!searchTerm) {
      return [];
    }

    // 우선순위: 1. 구글 뉴스 RSS (무료, API 키 불필요) > 2. 네이버 검색 API > 3. 기존 RSS 필터링
    try {
      // 1순위: 구글 뉴스 RSS 사용 (한국어)
      news = await fetchGoogleNewsRSS(searchTerm, stockName, ticker, 'ko', daysBack);
      
      if (news.length > 0) {
        console.log(`구글 뉴스 RSS로 ${news.length}개 뉴스 수집`);
      } else {
        // 구글 뉴스가 없으면 네이버 API 시도
        if (isNaverApiConfigured()) {
          console.log(`구글 뉴스 없음, 네이버 검색 API로 시도: "${searchTerm}"`);
          news = await searchNaverStockNews(searchTerm, 50);
          
          if (news.length > 0) {
            console.log(`네이버 검색 API로 ${news.length}개 뉴스 수집`);
          }
        }
        
        // 네이버 API도 없거나 실패하면 기존 RSS 필터링 시도
        if (news.length === 0) {
          console.log(`네이버 API 없음, RSS 필터링으로 시도: "${searchTerm}"`);
          news = await fetchStockNewsFromRSS(searchTerm, stockName, ticker);
        }
      }
      
      // 관련 종목명 정보 추가
      news = news.map(item => ({
        ...item,
        relatedStockName: stockName,
        relatedTicker: ticker,
      }));

      // 시간순 정렬 (최신 뉴스가 맨 위)
      news.sort((a, b) => {
        const dateA = a.publishedAt.getTime();
        const dateB = b.publishedAt.getTime();
        return dateB - dateA; // 내림차순 (최신이 먼저)
      });
    } catch (error) {
      console.warn('종목별 뉴스 검색 실패:', error);
      news = [];
    }
  }

  // 캐시에 저장
  if (news.length > 0) {
    await setCachedNews(cacheKey, news);
  }

  return news;
}

