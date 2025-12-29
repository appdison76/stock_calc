import { ProductItem, productItemFromJson } from '../models/ProductItem';

// 구글 시트 웹앱 실행 URL
const API_URL = 
    'https://script.google.com/macros/s/AKfycbxILvgSQlBXNqigrLprPT9T8KcWVqliz22k_J_13Cij8F6Xu2ew7yFH55YXunRRT3iJ3w/exec';

export class CoupangApiService {
  /// 구글 시트에서 쿠팡 상품 데이터를 가져옵니다.
  /// 재시도 로직 포함 (최대 3번 시도)
  static async fetchProducts(maxRetries: number = 3): Promise<ProductItem[]> {
    let attempt = 0;
    
    while (attempt < maxRetries) {
      try {
        attempt++;
        console.log(`Fetching products from: ${API_URL} (Attempt ${attempt}/${maxRetries})`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const response = await fetch(API_URL, {
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        console.log(`Response status: ${response.status}`);

        if (response.ok) {
          const body = (await response.text()).trim();
          if (body.length === 0) {
            console.log('Empty response body');
            return [];
          }

          // JSON 응답 파싱
          let data: any;
          try {
            data = JSON.parse(body);
          } catch (e) {
            console.log('JSON decode error:', e);
            return [];
          }
          
          console.log('Parsed data type:', typeof data);
          
          let items: any[] = [];
          
          // 응답이 배열인 경우
          if (Array.isArray(data)) {
            console.log('Data is Array, length:', data.length);
            items = data;
          }
          // 응답이 객체인 경우
          else if (typeof data === 'object' && data !== null) {
            console.log('Data is Object, keys:', Object.keys(data));
            
            // products 키 확인
            if (data['products'] != null && Array.isArray(data['products'])) {
              items = data['products'];
              console.log('Found products list, length:', items.length);
            }
            // data 키 확인
            else if (data['data'] != null && Array.isArray(data['data'])) {
              items = data['data'];
              console.log('Found data list, length:', items.length);
            }
            // items 키 확인
            else if (data['items'] != null && Array.isArray(data['items'])) {
              items = data['items'];
              console.log('Found items list, length:', items.length);
            }
            // 첫 번째 값이 배열인 경우
            else if (Object.keys(data).length > 0) {
              const firstValue = Object.values(data)[0];
              if (Array.isArray(firstValue)) {
                items = firstValue;
                console.log('Using first value as list, length:', items.length);
              }
            }
          }
          
          // 아이템들을 ProductItem으로 변환
          if (items.length > 0) {
            console.log(`Processing ${items.length} items...`);
            const products: ProductItem[] = [];
            
            for (const item of items) {
              try {
                if (typeof item === 'object' && item !== null) {
                  const product = productItemFromJson(item);
                  // name과 coupangUrl이 모두 있어야 유효한 상품
                  if (product.name.length > 0 && product.coupangUrl.length > 0) {
                    products.push(product);
                    console.log('Added product:', product.name);
                  } else {
                    console.log('Skipped product (empty name or url)');
                  }
                }
              } catch (e) {
                console.log('Error parsing item:', e);
              }
            }
            
            console.log(`Successfully parsed ${products.length} products`);
            return products;
          } else {
            console.log('No items found in response');
            return [];
          }
        } else {
          throw new Error(`Failed to load products: ${response.status}`);
        }
      } catch (e) {
        console.log(`Error fetching products (Attempt ${attempt}/${maxRetries}):`, e);
        
        // 마지막 시도가 아니면 재시도
        if (attempt < maxRetries) {
          console.log(`Retrying in ${attempt * 2} seconds...`);
          await new Promise(resolve => setTimeout(resolve, attempt * 2000)); // 지수 백오프
          continue;
        }
        
        // 모든 시도 실패 시 빈 리스트 반환
        console.log('All retry attempts failed. Returning empty list.');
        return [];
      }
    }
    
    // 루프를 벗어난 경우 (이론적으로는 도달하지 않음)
    return [];
  }
}



