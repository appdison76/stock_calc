import { InteractionManager } from 'react-native';
import { getAllAccounts, initDatabase } from '../services/DatabaseService';

export type OpenAddStockRouter = {
  push: (href: string) => void;
  setParams?: (params: Record<string, string>) => void;
};

export type OpenDefaultPortfolioAddStockContext = {
  pathname?: string | null;
  /** 현재 포커스된 화면의 포트폴리오 id (portfolio-detail일 때만有意義) */
  currentPortfolioId?: string | null;
};

/**
 * 하단 탭·메인의 「종목 추가」: 기본 포트폴리오 상세로 이동(스크롤 유도).
 * - 포트폴리오가 없으면 목록 화면으로 보냄
 * - 이미 같은 포트폴리오 상세에 있으면 setParams로 재진입 (스택 중복·push 무시 방지)
 * - 그 외에는 쿼리에 타임스탬프를 넣어 동일 URL push가 무시되는 기기 대응
 */
export function openDefaultPortfolioAddStock(
  router: OpenAddStockRouter,
  ctx?: OpenDefaultPortfolioAddStockContext
): void {
  void (async () => {
    try {
      await initDatabase();
      const accounts = await getAllAccounts();
      let defaultAccount = accounts.find((a) => a.name === '나의 포트폴리오');
      if (!defaultAccount && accounts.length > 0) {
        defaultAccount = accounts[0];
      }
      if (!defaultAccount) {
        router.push('/portfolios');
        return;
      }
      const id = String(defaultAccount.id);
      const path = ctx?.pathname ?? '';
      const onSamePortfolioDetail =
        path.includes('portfolio-detail') &&
        ctx?.currentPortfolioId != null &&
        String(ctx.currentPortfolioId) === id;

      const go = () => {
        if (onSamePortfolioDetail && typeof router.setParams === 'function') {
          router.setParams({
            scrollToAdd: 'true',
            _t: String(Date.now()),
          });
          return;
        }
        const href = `/portfolio-detail?id=${encodeURIComponent(id)}&scrollToAdd=true&_t=${Date.now()}`;
        router.push(href);
      };

      InteractionManager.runAfterInteractions(() => {
        requestAnimationFrame(go);
      });
    } catch (e) {
      console.error('기본 포트폴리오 찾기 오류:', e);
      router.push('/portfolios');
    }
  })();
}
