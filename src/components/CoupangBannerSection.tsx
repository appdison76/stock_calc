import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { ProductItem } from '../models/ProductItem';
import { CoupangApiService } from '../services/CoupangApiService';

interface CoupangBannerSectionProps {}

export interface CoupangBannerSectionRef {
  refreshRandomProducts: () => void;
}

export const CoupangBannerSection = forwardRef<
  CoupangBannerSectionRef,
  CoupangBannerSectionProps
>((props, ref) => {
  const [allProducts, setAllProducts] = useState<ProductItem[]>([]);
  const [displayedProducts, setDisplayedProducts] = useState<ProductItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useImperativeHandle(ref, () => ({
    refreshRandomProducts: selectRandomProducts,
  }));

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setIsLoading(true);
    setHasError(false);

    try {
      console.log('CoupangBannerSection: Loading products...');
      const products = await CoupangApiService.fetchProducts();
      console.log(`CoupangBannerSection: Received ${products.length} products`);

      // 최대 20개까지 저장
      const limitedProducts = products.length > 20 ? products.slice(0, 20) : products;

      setAllProducts(limitedProducts);
      setIsLoading(false);
      setHasError(limitedProducts.length === 0);

      // 초기 로드 시 랜덤으로 5개 선택하여 표시
      if (limitedProducts.length > 0) {
        selectRandomProductsFromList(limitedProducts);
      }
    } catch (e) {
      console.error('CoupangBannerSection: Error loading products:', e);
      setIsLoading(false);
      setHasError(true);
    }
  };

  const selectRandomProductsFromList = (products: ProductItem[]) => {
    if (products.length === 0) {
      setDisplayedProducts([]);
      return;
    }

    // 상품이 5개 이하면 모두 표시
    if (products.length <= 5) {
      setDisplayedProducts([...products]);
      return;
    }

    // 랜덤으로 5개 선택
    const selected: ProductItem[] = [];
    const indices = new Set<number>();

    while (indices.size < 5) {
      indices.add(Math.floor(Math.random() * products.length));
    }

    Array.from(indices).forEach((index) => {
      selected.push(products[index]);
    });

    // 리스트를 섞어서 매번 다른 순서로 표시
    for (let i = selected.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [selected[i], selected[j]] = [selected[j], selected[i]];
    }

    setDisplayedProducts(selected);
  };

  const selectRandomProducts = () => {
    if (allProducts.length > 0) {
      selectRandomProductsFromList(allProducts);
    }
  };

  const formatPrice = (price: string): string => {
    // 숫자만 추출 (원, ₩, 공백 등 제거)
    const cleanedPrice = price.replace(/[^0-9]/g, '');
    if (cleanedPrice.length === 0) {
      return price;
    }

    const priceNum = parseInt(cleanedPrice, 10);
    if (isNaN(priceNum)) {
      return price;
    }

    // 천단위 콤마 추가
    const priceString = priceNum.toString();
    let buffer = '';

    for (let i = 0; i < priceString.length; i++) {
      if (i > 0 && (priceString.length - i) % 3 === 0) {
        buffer += ',';
      }
      buffer += priceString[i];
    }

    return `${buffer}원`;
  };

  const handleProductTap = async (url: string) => {
    try {
      if (!url || url.trim().length === 0) {
        console.error('Empty URL provided');
        Alert.alert('오류', '유효하지 않은 링크입니다.');
        return;
      }

      // URL 앞뒤 공백 제거
      let trimmedUrl = url.trim();
      
      // URL이 http:// 또는 https://로 시작하지 않으면 추가
      if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
        trimmedUrl = 'https://' + trimmedUrl;
      }

      console.log('Attempting to open URL:', trimmedUrl);

      // expo-web-browser를 사용하여 인앱 브라우저로 열기
      await WebBrowser.openBrowserAsync(trimmedUrl, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.AUTOMATIC,
        enableBarCollapsing: false,
        showTitle: true,
      });
    } catch (e: any) {
      console.error('Error opening URL:', e);
      const errorMessage = e?.message || '알 수 없는 오류가 발생했습니다.';
      Alert.alert('오류', `링크를 열 수 없습니다: ${errorMessage}`);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Text style={styles.headerIconText}>🛍️</Text>
        </View>
        <Text style={styles.headerText}>쿠팡 베스트 상품</Text>
      </View>
      <View style={styles.scrollContainer}>
        {isLoading ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {[1, 2, 3].map((i, index) => (
              <View key={`skeleton-${index}`} style={styles.skeletonCard}>
                <ActivityIndicator size="small" color="#FF9800" />
              </View>
            ))}
          </ScrollView>
        ) : hasError || displayedProducts.length === 0 ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorText}>상품 정보를 불러올 수 없습니다</Text>
            <TouchableOpacity onPress={loadProducts} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>다시 시도</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {displayedProducts.map((product, index) => (
              <ProductCard
                key={`product-${index}`}
                product={product}
                formatPrice={formatPrice}
                onTap={() => handleProductTap(product.coupangUrl)}
              />
            ))}
          </ScrollView>
        )}
      </View>
      {!isLoading && !hasError && displayedProducts.length > 0 && (
        <Text style={styles.disclaimer}>
          이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
        </Text>
      )}
    </View>
  );
});

interface ProductCardProps {
  product: ProductItem;
  formatPrice: (price: string) => string;
  onTap: () => void;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, formatPrice, onTap }) => {
  const imageUrl = product.imageUrl || product.wpImageUrl || '';

  const handlePress = () => {
    console.log('Product card pressed:', product.name);
    console.log('Product URL:', product.coupangUrl);
    onTap();
  };

  return (
    <TouchableOpacity
      style={styles.productCard}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <View style={styles.productImageContainer}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.productImage} />
        ) : (
          <View style={styles.productImagePlaceholder}>
            <Text style={styles.productImagePlaceholderIcon}>📦</Text>
          </View>
        )}
        <View style={styles.ratingBadge}>
          <Text style={styles.ratingIcon}>⭐</Text>
          <Text style={styles.ratingText}>{product.rating.toFixed(1)}</Text>
        </View>
      </View>
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={2}>
          {product.name}
        </Text>
        <View style={styles.productPriceRow}>
          <Text style={styles.productPrice}>{formatPrice(product.price)}</Text>
          <Text style={styles.productArrow}>→</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 152, 0, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerIconText: {
    fontSize: 20,
  },
  headerText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  scrollContainer: {
    height: 200,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  skeletonCard: {
    width: 160,
    height: 200,
    marginRight: 16,
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  errorText: {
    color: '#757575',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  retryButtonText: {
    color: '#FF9800',
    fontSize: 14,
  },
  productCard: {
    width: 160,
    marginRight: 16,
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(66, 66, 66, 0.5)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  productImageContainer: {
    flex: 3,
    backgroundColor: '#121212',
    position: 'relative',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  productImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#121212',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productImagePlaceholderIcon: {
    fontSize: 50,
    opacity: 0.3,
  },
  ratingBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 152, 0, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  ratingIcon: {
    fontSize: 12,
  },
  ratingText: {
    color: '#FF9800',
    fontSize: 11,
    fontWeight: 'bold',
    marginLeft: 2,
  },
  productInfo: {
    flex: 2,
    padding: 12,
    justifyContent: 'space-between',
  },
  productName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 15.6,
    marginBottom: 6,
  },
  productPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  productPrice: {
    color: '#FF9800',
    fontSize: 15,
    fontWeight: 'bold',
    flex: 1,
  },
  productArrow: {
    color: '#757575',
    fontSize: 14,
    marginLeft: 4,
  },
  disclaimer: {
    color: '#757575',
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
});

