import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { NewsItem } from '../models/NewsItem';
import { formatDistanceToNow } from 'date-fns';

interface NewsCardProps {
  news: NewsItem;
  onPress?: () => void;
}

export default function NewsCard({ news, onPress }: NewsCardProps) {
  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      // 기본 동작: 웹뷰 또는 브라우저로 링크 열기
      Linking.openURL(news.link).catch(err => 
        console.error('링크 열기 실패:', err)
      );
    }
  };

  const timeAgo = formatDistanceToNow(news.publishedAt, {
    addSuffix: true,
  });

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>
          {news.title}
        </Text>
        {news.description ? (
          <Text style={styles.description} numberOfLines={2}>
            {news.description}
          </Text>
        ) : null}
        <View style={styles.footer}>
          <Text style={styles.source}>{news.source}</Text>
          <Text style={styles.separator}> · </Text>
          <Text style={styles.time}>{timeAgo}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
    lineHeight: 22,
  },
  description: {
    fontSize: 14,
    color: '#B0BEC5',
    marginBottom: 12,
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  source: {
    fontSize: 12,
    color: '#94A3B8',
  },
  separator: {
    fontSize: 12,
    color: '#64748B',
  },
  time: {
    fontSize: 12,
    color: '#94A3B8',
  },
});

