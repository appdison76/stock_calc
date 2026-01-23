import AsyncStorage from '@react-native-async-storage/async-storage';
import { initDatabase, getAllAccounts, getStocksByAccountId } from './DatabaseService';
import { fetchStockNews } from './NewsService';
import { getStockQuote } from './YahooFinanceService';
import { sendLocalNotification } from './NotificationService';
import { SettingsService } from './SettingsService';
import { Stock } from '../models/Stock';
import { Currency } from '../models/Currency';

const LAST_NEWS_CHECK_KEY = '@last_news_check';
const LAST_PROFIT_CHECK_KEY = '@last_profit_check';
const LAST_CHECKED_NEWS_KEY = '@last_checked_news'; // 마지막으로 확인한 뉴스 제목들
const LAST_CHECKED_PROFIT_KEY = '@last_checked_profit'; // 마지막으로 확인한 수익 알림 종목들
const LAST_CHECKED_LOSS_KEY = '@last_checked_loss'; // 마지막으로 확인한 손실 알림 종목들
const LAST_PROFIT_NOTIFICATION_TIME_KEY = '@last_profit_notification_time'; // 종목별 마지막 수익 알림 시간
const LAST_LOSS_NOTIFICATION_TIME_KEY = '@last_loss_notification_time'; // 종목별 마지막 손실 알림 시간
const LAST_PROFIT_RATE_KEY = '@last_profit_rate'; // 종목별 마지막 수익 알림 수익률
const LAST_LOSS_RATE_KEY = '@last_loss_rate'; // 종목별 마지막 손실 알림 손실률

/**
 * 종목뉴스 알림 체크
 */
export async function checkStockNewsNotifications(): Promise<void> {
  try {
    // 알림 설정 확인
    const enableNewsNotifications = await SettingsService.getEnableNewsNotifications();
    if (!enableNewsNotifications) {
      console.log('⏭️ 뉴스 알림이 비활성화되어 있습니다.');
      return;
    }

    console.log('📰 종목뉴스 알림 체크 시작...');
    
    // 마지막 체크 시간 확인
    const lastCheckStr = await AsyncStorage.getItem(LAST_NEWS_CHECK_KEY);
    const lastCheck = lastCheckStr ? parseInt(lastCheckStr, 10) : 0;
    const now = Date.now();
    
    // 최소 간격 체크 (30분마다)
    const MIN_INTERVAL = 30 * 60 * 1000; // 30분
    if (now - lastCheck < MIN_INTERVAL) {
      console.log('⏭️ 종목뉴스 체크 스킵 (최소 간격 미달)');
      return;
    }
    
    // 포트폴리오 종목 가져오기
    await initDatabase();
    const accounts = await getAllAccounts();
    const allStocks: Stock[] = [];
    
    for (const account of accounts) {
      const stocks = await getStocksByAccountId(account.id);
      allStocks.push(...stocks);
    }
    
    if (allStocks.length === 0) {
      console.log('ℹ️ 포트폴리오에 종목이 없습니다.');
      await AsyncStorage.setItem(LAST_NEWS_CHECK_KEY, now.toString());
      return;
    }
    
    // 중복 제거 (같은 ticker는 한 번만)
    const uniqueStocks = Array.from(
      new Map(allStocks.map(stock => [stock.ticker, stock])).values()
    );
    
    console.log(`📊 ${uniqueStocks.length}개 종목의 뉴스 체크 중...`);
    
    // 마지막으로 확인한 뉴스 제목들 가져오기
    const lastCheckedNewsStr = await AsyncStorage.getItem(LAST_CHECKED_NEWS_KEY);
    const lastCheckedNews: Set<string> = lastCheckedNewsStr 
      ? new Set(JSON.parse(lastCheckedNewsStr))
      : new Set();
    
    const newNewsTitles = new Set<string>();
    let notificationCount = 0;
    
    // 각 종목별로 최신 뉴스 체크 (최대 30개 종목까지)
    const stocksToCheck = uniqueStocks.slice(0, 30);
    
    for (const stock of stocksToCheck) {
      try {
        const stockName = stock.officialName || stock.name || stock.ticker;
        const currency = stock.currency as Currency;
        
        // 최근 1일 이내 뉴스만 체크
        const news = await fetchStockNews(
          stock.ticker,
          stockName,
          currency,
          true, // forceRefresh
          1 // daysBack: 1일
        );
        
        // 최신 뉴스 3개만 확인
        const latestNews = news.slice(0, 3);
        
        for (const newsItem of latestNews) {
          const newsKey = `${stock.ticker}_${newsItem.title}`;
          
          // 이미 확인한 뉴스가 아니면 알림 발송
          if (!lastCheckedNews.has(newsKey)) {
            newNewsTitles.add(newsKey);
            
            // 뉴스 알림 발송 (ticker별로 한 번만, 외부 링크로 이동)
            await sendLocalNotification(
              `📰 ${stockName} 관련 뉴스`,
              newsItem.title,
              {
                link: newsItem.link, // 뉴스 링크 (외부 브라우저로 열기)
                ticker: stock.ticker,
                stockName: stockName,
              }
            );
            
            notificationCount++;
            console.log(`✅ ${stockName} 뉴스 알림 발송: ${newsItem.title.substring(0, 30)}...`);
          }
        }
        
        // Rate Limit 방지를 위한 딜레이
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`❌ ${stock.ticker} 뉴스 체크 오류:`, error);
      }
    }
    
    // 마지막 체크 시간 업데이트
    await AsyncStorage.setItem(LAST_NEWS_CHECK_KEY, now.toString());
    
    // 확인한 뉴스 제목들 업데이트 (최대 100개만 유지)
    const updatedCheckedNews = Array.from(new Set([...Array.from(lastCheckedNews), ...Array.from(newNewsTitles)]));
    const trimmedCheckedNews = updatedCheckedNews.slice(-100);
    await AsyncStorage.setItem(LAST_CHECKED_NEWS_KEY, JSON.stringify(trimmedCheckedNews));
    
    console.log(`✅ 종목뉴스 알림 체크 완료: ${notificationCount}개 알림 발송`);
  } catch (error) {
    console.error('❌ 종목뉴스 알림 체크 오류:', error);
  }
}

/**
 * 수익 알림 체크
 */
export async function checkProfitNotifications(): Promise<void> {
  try {
    // 알림 설정 확인
    const enableStockNotifications = await SettingsService.getEnableStockNotifications();
    if (!enableStockNotifications) {
      console.log('⏭️ 종목 알림이 비활성화되어 있습니다.');
      return;
    }

    console.log('💰 수익 알림 체크 시작...');
    
    // 마지막 체크 시간 확인
    const lastCheckStr = await AsyncStorage.getItem(LAST_PROFIT_CHECK_KEY);
    const lastCheck = lastCheckStr ? parseInt(lastCheckStr, 10) : 0;
    const now = Date.now();
    
    // 최소 간격 체크 (30분마다)
    const MIN_INTERVAL = 30 * 60 * 1000; // 30분
    if (now - lastCheck < MIN_INTERVAL) {
      console.log('⏭️ 수익 알림 체크 스킵 (최소 간격 미달)');
      return;
    }
    
    // 포트폴리오 종목 가져오기
    await initDatabase();
    const accounts = await getAllAccounts();
    const allStocks: Stock[] = [];
    
    for (const account of accounts) {
      const stocks = await getStocksByAccountId(account.id);
      allStocks.push(...stocks);
    }
    
    if (allStocks.length === 0) {
      console.log('ℹ️ 포트폴리오에 종목이 없습니다.');
      await AsyncStorage.setItem(LAST_PROFIT_CHECK_KEY, now.toString());
      return;
    }
    
    // 평단가가 있고, 수량이 0보다 큰 종목만 체크
    const stocksToCheck = allStocks.filter(
      stock => stock.averagePrice > 0 && stock.quantity > 0
    );
    
    if (stocksToCheck.length === 0) {
      console.log('ℹ️ 체크할 종목이 없습니다.');
      await AsyncStorage.setItem(LAST_PROFIT_CHECK_KEY, now.toString());
      return;
    }
    
    console.log(`📊 ${stocksToCheck.length}개 종목의 수익/손실 체크 중...`);
    
    // 종목별 마지막 알림 시간 가져오기
    const lastProfitNotificationTimeStr = await AsyncStorage.getItem(LAST_PROFIT_NOTIFICATION_TIME_KEY);
    const lastProfitNotificationTime: { [stockId: string]: number } = lastProfitNotificationTimeStr 
      ? JSON.parse(lastProfitNotificationTimeStr)
      : {};
    
    const lastLossNotificationTimeStr = await AsyncStorage.getItem(LAST_LOSS_NOTIFICATION_TIME_KEY);
    const lastLossNotificationTime: { [stockId: string]: number } = lastLossNotificationTimeStr 
      ? JSON.parse(lastLossNotificationTimeStr)
      : {};
    
    // 종목별 마지막 알림 수익률/손실률 가져오기
    const lastProfitRateStr = await AsyncStorage.getItem(LAST_PROFIT_RATE_KEY);
    const lastProfitRate: { [stockId: string]: number } = lastProfitRateStr 
      ? JSON.parse(lastProfitRateStr)
      : {};
    
    const lastLossRateStr = await AsyncStorage.getItem(LAST_LOSS_RATE_KEY);
    const lastLossRate: { [stockId: string]: number } = lastLossRateStr 
      ? JSON.parse(lastLossRateStr)
      : {};
    
    let profitNotificationCount = 0;
    let lossNotificationCount = 0;
    const MIN_NOTIFICATION_INTERVAL = 30 * 60 * 1000; // 30분
    const MIN_RATE_CHANGE = 1.0; // 최소 변동률 1%
    
    // 각 종목별로 현재가 조회
    for (const stock of stocksToCheck) {
      try {
        // 현재가가 이미 있으면 그것을 사용, 없으면 API 호출
        let currentPrice = stock.currentPrice;
        
        if (!currentPrice) {
          const quote = await getStockQuote(stock.ticker);
          if (quote) {
            currentPrice = quote.price;
            // DB에 현재가 업데이트 (선택사항)
          }
        }
        
        if (!currentPrice || currentPrice <= 0) {
          continue;
        }
        
        const stockKey = stock.id;
        const stockName = stock.officialName || stock.name || stock.ticker;
        const currencySymbol = stock.currency === Currency.KRW ? '원' : '$';
        
        // 수익률 계산
        const profitRate = ((currentPrice - stock.averagePrice) / stock.averagePrice) * 100;
        const profitAmount = (currentPrice - stock.averagePrice) * stock.quantity;
        const lossAmount = (stock.averagePrice - currentPrice) * stock.quantity;
        
        // 수익 알림: 1% 이상 수익이고, 30분 이상 지났고, 이전 알림보다 1% 이상 변했을 때 알림
        if (currentPrice > stock.averagePrice && profitRate >= 1.0) {
          const lastNotificationTime = lastProfitNotificationTime[stockKey] || 0;
          const previousProfitRate = lastProfitRate[stockKey];
          
          // 30분 이상 지났는지 확인
          const timePassed = now - lastNotificationTime >= MIN_NOTIFICATION_INTERVAL;
          
          // 이전 알림이 없거나, 이전 알림보다 1% 이상 변했는지 확인
          const rateChanged = previousProfitRate === undefined || 
            Math.abs(profitRate - previousProfitRate) >= MIN_RATE_CHANGE;
          
          if (timePassed && rateChanged) {
            lastProfitNotificationTime[stockKey] = now;
            lastProfitRate[stockKey] = profitRate;
            
            // 메시지 결정: 발생/확대/축소
            let title: string;
            let body: string;
            
            if (previousProfitRate === undefined) {
              // 첫 알림: 수익 발생
              title = `⬆️ ${stockName} 수익 발생`;
              body = `현재가가 평단가를 ${profitRate.toFixed(2)}% 초과했습니다.\n수익: ${profitAmount.toLocaleString()}${currencySymbol}`;
            } else if (profitRate > previousProfitRate) {
              // 수익 확대
              title = `⬆️ ${stockName} 수익 확대`;
              body = `수익률이 ${previousProfitRate.toFixed(2)}%에서 ${profitRate.toFixed(2)}%로 증가했습니다.\n수익: ${profitAmount.toLocaleString()}${currencySymbol}`;
            } else {
              // 수익 축소
              title = `⬆️ ${stockName} 수익 축소`;
              body = `수익률이 ${previousProfitRate.toFixed(2)}%에서 ${profitRate.toFixed(2)}%로 감소했습니다.\n수익: ${profitAmount.toLocaleString()}${currencySymbol}`;
            }
            
            await sendLocalNotification(
              title,
              body,
              {
                route: `/stock-detail?id=${stock.id}`,
                ticker: stock.ticker,
                stockName: stockName,
                profitRate: profitRate.toFixed(2),
              }
            );
            
            profitNotificationCount++;
            console.log(`✅ ${stockName} 수익 알림 발송: ${profitRate.toFixed(2)}% 수익 (이전: ${previousProfitRate?.toFixed(2) || '없음'}%)`);
          }
        }
        
        // 손실 알림: 1% 이상 손실이고, 30분 이상 지났고, 이전 알림보다 1% 이상 변했을 때 알림
        if (currentPrice < stock.averagePrice && profitRate <= -1.0) {
          const lastNotificationTime = lastLossNotificationTime[stockKey] || 0;
          const previousLossRate = lastLossRate[stockKey];
          const currentLossRate = Math.abs(profitRate);
          
          // 30분 이상 지났는지 확인
          const timePassed = now - lastNotificationTime >= MIN_NOTIFICATION_INTERVAL;
          
          // 이전 알림이 없거나, 이전 알림보다 1% 이상 변했는지 확인
          const rateChanged = previousLossRate === undefined || 
            Math.abs(currentLossRate - previousLossRate) >= MIN_RATE_CHANGE;
          
          if (timePassed && rateChanged) {
            lastLossNotificationTime[stockKey] = now;
            lastLossRate[stockKey] = currentLossRate;
            
            // 메시지 결정: 발생/확대/축소
            let title: string;
            let body: string;
            
            if (previousLossRate === undefined) {
              // 첫 알림: 손실 발생
              title = `🔻 ${stockName} 손실 발생`;
              body = `현재가가 평단가보다 ${currentLossRate.toFixed(2)}% 하락했습니다.\n손실: ${lossAmount.toLocaleString()}${currencySymbol}\n물타기 기회를 고려해보세요.`;
            } else if (currentLossRate > previousLossRate) {
              // 손실 확대
              title = `🔻 ${stockName} 손실 확대`;
              body = `손실률이 ${previousLossRate.toFixed(2)}%에서 ${currentLossRate.toFixed(2)}%로 증가했습니다.\n손실: ${lossAmount.toLocaleString()}${currencySymbol}\n물타기 기회를 고려해보세요.`;
            } else {
              // 손실 축소
              title = `🔻 ${stockName} 손실 축소`;
              body = `손실률이 ${previousLossRate.toFixed(2)}%에서 ${currentLossRate.toFixed(2)}%로 감소했습니다.\n손실: ${lossAmount.toLocaleString()}${currencySymbol}`;
            }
            
            await sendLocalNotification(
              title,
              body,
              {
                route: `/stock-detail?id=${stock.id}`,
                ticker: stock.ticker,
                stockName: stockName,
                lossRate: currentLossRate.toFixed(2),
              }
            );
            
            lossNotificationCount++;
            console.log(`✅ ${stockName} 손실 알림 발송: ${currentLossRate.toFixed(2)}% 손실 (이전: ${previousLossRate?.toFixed(2) || '없음'}%)`);
          }
        }
        
        // Rate Limit 방지를 위한 딜레이
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`❌ ${stock.ticker} 수익/손실 체크 오류:`, error);
      }
    }
    
    // 마지막 체크 시간 업데이트
    await AsyncStorage.setItem(LAST_PROFIT_CHECK_KEY, now.toString());
    
    // 종목별 마지막 알림 시간 및 수익률/손실률 업데이트
    await AsyncStorage.setItem(LAST_PROFIT_NOTIFICATION_TIME_KEY, JSON.stringify(lastProfitNotificationTime));
    await AsyncStorage.setItem(LAST_LOSS_NOTIFICATION_TIME_KEY, JSON.stringify(lastLossNotificationTime));
    await AsyncStorage.setItem(LAST_PROFIT_RATE_KEY, JSON.stringify(lastProfitRate));
    await AsyncStorage.setItem(LAST_LOSS_RATE_KEY, JSON.stringify(lastLossRate));
    
    const totalNotificationCount = profitNotificationCount + lossNotificationCount;
    console.log(`✅ 수익/손실 알림 체크 완료: 수익 ${profitNotificationCount}개, 손실 ${lossNotificationCount}개 (총 ${totalNotificationCount}개) 알림 발송`);
  } catch (error) {
    console.error('❌ 수익 알림 체크 오류:', error);
  }
}

/**
 * 모든 알림 체크 (종목뉴스 + 수익)
 */
export async function checkAllNotifications(): Promise<void> {
  await Promise.all([
    checkStockNewsNotifications(),
    checkProfitNotifications(),
  ]);
}
