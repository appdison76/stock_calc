import React from 'react';
import { View, StyleSheet, Platform, Text } from 'react-native';
import { WebView } from 'react-native-webview';

interface CoupangDynamicBannerProps {
  width?: number;
  height?: number;
}

export const CoupangDynamicBanner: React.FC<CoupangDynamicBannerProps> = ({
  width = 320,
  height = 140,
}) => {
  // iframe 버전 사용 (더 안정적)
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <style>
          body {
            margin: 0;
            padding: 0;
            overflow: hidden;
            background-color: transparent;
          }
          iframe {
            border: none;
            width: 100%;
            height: 100%;
          }
        </style>
      </head>
      <body>
        <iframe 
          src="https://ads-partners.coupang.com/widgets.html?id=957915&template=carousel&trackingCode=AF3962095&subId=&width=${width}&height=${height}&tsource=" 
          width="${width}" 
          height="${height}" 
          frameborder="0" 
          scrolling="no" 
          referrerpolicy="unsafe-url" 
          browsingtopics>
        </iframe>
      </body>
    </html>
  `;

  return (
    <View style={styles.wrapper}>
      {/* 쿠팡 파트너스 고지 문구 */}
      <Text style={styles.disclosureText}>
        이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
      </Text>
      
      <View style={[styles.container, { width, height }]}>
        <WebView
          source={{ html: htmlContent }}
          style={styles.webview}
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          scalesPageToFit={Platform.OS === 'android'}
          originWhitelist={['*']}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginVertical: 16,
    alignSelf: 'center',
  },
  disclosureText: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 16,
    lineHeight: 16,
  },
  container: {
    alignSelf: 'center',
    overflow: 'hidden',
    borderRadius: 8,
  },
  webview: {
    backgroundColor: 'transparent',
  },
});
