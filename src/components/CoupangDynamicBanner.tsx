import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
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
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
    alignSelf: 'center',
    overflow: 'hidden',
    borderRadius: 8,
  },
  webview: {
    backgroundColor: 'transparent',
  },
});
