export interface ProductItem {
  id: string;
  name: string;
  price: string;
  imageUrl: string;
  wpImageUrl: string; // 블로그 이미지 URL (CORS 문제 없음)
  coupangUrl: string; // 쿠팡 파트너스 링크
  rating: number;
}

let productItemCounter = 0;

export function productItemFromJson(json: any): ProductItem {
  // ID는 자동 생성 또는 제공된 값 사용
  // 고유성을 보장하기 위해 카운터 사용
  productItemCounter += 1;
  const id = json.id?.toString() ?? `product-${Date.now()}-${productItemCounter}`;
  
  // 상품명: name 필드 사용
  const name = json.name?.toString() ?? '';
  
  // 가격: price 필드 사용
  const price = json.price?.toString() ?? '';
  
  // 이미지 주소: imageUrl 필드 사용 (다른 필드명도 확인)
  const imageUrl = json.imageUrl?.toString() ?? 
                   json.image?.toString() ?? 
                   json.img?.toString() ?? 
                   json.image_url?.toString() ?? '';
  
  // 블로그 이미지 URL: wpImageUrl 필드 사용
  const wpImageUrl = json.wpImageUrl?.toString() ?? 
                     json.wpImage?.toString() ?? 
                     json.wp_img?.toString() ?? 
                     json.wp_image_url?.toString() ?? '';
  
  // 제휴 링크: productUrl 필드 사용
  const productUrl = json.productUrl?.toString() ?? '';
  
  // 별점: 기본값 5.0
  const rating = json.rating != null 
      ? (typeof json.rating === 'number' 
          ? json.rating 
          : parseFloat(json.rating.toString()) || 5.0)
      : 5.0;
  
  return {
    id,
    name,
    price,
    imageUrl,
    wpImageUrl,
    coupangUrl: productUrl,
    rating,
  };
}

