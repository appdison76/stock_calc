import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import mobileAds from 'react-native-google-mobile-ads';

export default function RootLayout() {
  useEffect(() => {
    // Google Mobile Ads 초기화
    mobileAds()
      .initialize()
      .then(adapterStatuses => {
        console.log('Google Mobile Ads initialized:', adapterStatuses);
      })
      .catch(error => {
        console.error('Google Mobile Ads initialization error:', error);
      });
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: '#1E1E1E',
          },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          contentStyle: {
            backgroundColor: '#121212',
          },
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="profit"
          options={{
            title: '수익률 계산기',
          }}
        />
        <Stack.Screen
          name="averaging"
          options={{
            title: '물타기 계산기',
          }}
        />
        <Stack.Screen
          name="settings"
          options={{
            title: '환경설정',
          }}
        />
      </Stack>
    </>
  );
}

