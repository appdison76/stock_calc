import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getSavedNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  deleteAllNotifications,
  SavedNotification,
  getUnreadCount,
} from '../src/services/NotificationService';

type NotificationType = 'all' | 'news' | 'profit' | 'loss' | 'announcement';

// 알림 타입 구분 함수
const getNotificationType = (notification: SavedNotification): 'news' | 'profit' | 'loss' | 'announcement' => {
  const title = notification.title;
  
  if (title.startsWith('📰')) {
    return 'news';
  } else if (title.startsWith('⬆️')) {
    return 'profit';
  } else if (title.startsWith('🔻') || title.includes('손실 발생') || title.includes('손실 확대') || title.includes('손실 축소')) {
    return 'loss';
  } else {
    return 'announcement';
  }
};

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState<SavedNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterType, setFilterType] = useState<NotificationType>('all');

  const loadNotifications = async () => {
    try {
      const savedNotifications = await getSavedNotifications();
      console.log('📋 알림 목록 로드:', savedNotifications.length, '개');
      savedNotifications.forEach((notif, index) => {
        console.log(`알림 ${index + 1}:`, {
          title: notif.title,
          imageUrl: notif.imageUrl,
          hasImage: !!notif.imageUrl,
        });
      });
      setNotifications(savedNotifications);
    } catch (error) {
      console.error('알림 목록 로드 오류:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadNotifications();
  };

  const handleNotificationPress = async (notification: SavedNotification) => {
    // 읽지 않은 알림이면 읽음 처리
    if (!notification.read) {
      await markNotificationAsRead(notification.id);
      // 목록 업데이트
      const updatedNotifications = notifications.map(n =>
        n.id === notification.id ? { ...n, read: true } : n
      );
      setNotifications(updatedNotifications);
    }

    // link가 있으면 외부 브라우저로 열기 (뉴스 알림)
    const link = notification.data?.link;
    if (link) {
      try {
        await Linking.openURL(link);
        return;
      } catch (error) {
        console.error('링크 열기 실패:', error);
      }
    }

    // route가 있으면 해당 화면으로 이동
    if (notification.route) {
      router.push(notification.route as any);
    }
  };

  const handleMarkAllAsRead = async () => {
    Alert.alert(
      '모든 알림 읽음 처리',
      '모든 알림을 읽음 처리하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '확인',
          onPress: async () => {
            await markAllNotificationsAsRead();
            const updatedNotifications = notifications.map(n => ({ ...n, read: true }));
            setNotifications(updatedNotifications);
          },
        },
      ]
    );
  };

  const handleDeleteAll = async () => {
    Alert.alert(
      '모든 알림 삭제',
      '모든 알림을 삭제하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            await deleteAllNotifications();
            setNotifications([]);
          },
        },
      ]
    );
  };

  const handleDeleteNotification = async (notificationId: string) => {
    await deleteNotification(notificationId);
    const updatedNotifications = notifications.filter(n => n.id !== notificationId);
    setNotifications(updatedNotifications);
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);

      if (minutes < 1) return '방금 전';
      if (minutes < 60) return `${minutes}분 전`;
      if (hours < 24) return `${hours}시간 전`;
      if (days < 7) return `${days}일 전`;

      const month = date.getMonth() + 1;
      const day = date.getDate();
      return `${month}/${day}`;
    } catch (error) {
      return '';
    }
  };

  // 필터링된 알림 목록
  const filteredNotifications = filterType === 'all'
    ? notifications
    : notifications.filter(n => getNotificationType(n) === filterType);

  if (loading) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#000000', '#121212', '#1A1A1A', '#0D0D0D']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          <View style={[styles.header, { paddingTop: insets.top }]}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Text style={styles.backButtonText}>←</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>알림</Text>
            <View style={styles.headerRight} />
          </View>
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>알림을 불러오는 중...</Text>
          </View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#000000', '#121212', '#1A1A1A', '#0D0D0D']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>알림</Text>
          <View style={styles.headerRight}>
            {notifications.length > 0 && (
              <>
                <TouchableOpacity
                  style={styles.headerButton}
                  onPress={handleMarkAllAsRead}
                >
                  <Text style={styles.headerButtonText}>모두 읽음</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.headerButton}
                  onPress={handleDeleteAll}
                >
                  <Text style={styles.headerButtonText}>전체 삭제</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* 필터 버튼 */}
        <View style={styles.filterContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScrollContent}>
            <TouchableOpacity
              style={[styles.filterButton, filterType === 'all' && styles.filterButtonActive]}
              onPress={() => setFilterType('all')}
            >
              <Text style={[styles.filterButtonText, filterType === 'all' && styles.filterButtonTextActive]}>
                전체
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, filterType === 'news' && styles.filterButtonActive]}
              onPress={() => setFilterType('news')}
            >
              <Text style={[styles.filterButtonText, filterType === 'news' && styles.filterButtonTextActive]}>
                종목뉴스
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, filterType === 'profit' && styles.filterButtonActive]}
              onPress={() => setFilterType('profit')}
            >
              <Text style={[styles.filterButtonText, filterType === 'profit' && styles.filterButtonTextActive]}>
                수익 알림
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, filterType === 'loss' && styles.filterButtonActive]}
              onPress={() => setFilterType('loss')}
            >
              <Text style={[styles.filterButtonText, filterType === 'loss' && styles.filterButtonTextActive]}>
                손실 알림
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, filterType === 'announcement' && styles.filterButtonActive]}
              onPress={() => setFilterType('announcement')}
            >
              <Text style={[styles.filterButtonText, filterType === 'announcement' && styles.filterButtonTextActive]}>
                공지
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#FFFFFF"
              colors={['#FFFFFF']}
            />
          }
        >
          {filteredNotifications.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🔔</Text>
              <Text style={styles.emptyText}>
                {filterType === 'all' ? '알림이 없습니다' : `${filterType === 'news' ? '종목뉴스' : filterType === 'profit' ? '수익 알림' : filterType === 'loss' ? '손실 알림' : '공지'} 알림이 없습니다`}
              </Text>
              <Text style={styles.emptySubtext}>
                {filterType === 'all' 
                  ? '새로운 알림이 도착하면 여기에 표시됩니다.'
                  : '필터를 변경하거나 새로운 알림을 기다려주세요.'}
              </Text>
            </View>
          ) : (
            filteredNotifications.map((notification) => (
              <TouchableOpacity
                key={notification.id}
                style={[
                  styles.notificationCard,
                  !notification.read && styles.notificationCardUnread,
                ]}
                onPress={() => handleNotificationPress(notification)}
                activeOpacity={0.7}
              >
                <View style={styles.notificationContent}>
                  <View style={styles.notificationTextContainer}>
                    <View style={styles.notificationHeader}>
                      <Text
                        style={[
                          styles.notificationTitle,
                          !notification.read && styles.notificationTitleUnread,
                        ]}
                        numberOfLines={2}
                      >
                        {notification.title}
                      </Text>
                      {!notification.read && <View style={styles.unreadDot} />}
                    </View>
                    <Text
                      style={styles.notificationBody}
                    >
                      {notification.body}
                    </Text>
                    <Text style={styles.notificationDate}>
                      {formatDate(notification.receivedAt)}
                    </Text>
                  </View>
                  {notification.imageUrl ? (
                    <Image
                      source={{ uri: notification.imageUrl }}
                      style={styles.notificationImage}
                      resizeMode="cover"
                      onError={(error) => {
                        console.log('이미지 로딩 실패:', notification.imageUrl, error);
                      }}
                      onLoad={() => {
                        console.log('이미지 로딩 성공:', notification.imageUrl);
                      }}
                    />
                  ) : null}
                </View>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDeleteNotification(notification.id)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.deleteButtonText}>×</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 100,
    justifyContent: 'flex-end',
  },
  headerButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  headerButtonText: {
    fontSize: 14,
    color: '#42A5F5',
    fontWeight: '600',
  },
  filterContainer: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(18, 18, 18, 0.8)',
  },
  filterScrollContent: {
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginRight: 8,
  },
  filterButtonActive: {
    backgroundColor: '#42A5F5',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#B0BEC5',
    fontWeight: '600',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#B0BEC5',
    marginTop: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
  },
  notificationCard: {
    backgroundColor: 'rgba(45, 45, 45, 0.8)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  notificationCardUnread: {
    backgroundColor: 'rgba(66, 165, 245, 0.1)',
    borderColor: 'rgba(66, 165, 245, 0.3)',
  },
  notificationContent: {
    flexDirection: 'column',
  },
  imageContainer: {
    width: 60,
    height: 60,
    marginRight: 12,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  notificationImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginTop: 12,
  },
  imagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholderText: {
    fontSize: 24,
    opacity: 0.5,
  },
  notificationTextContainer: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#B0BEC5',
    flex: 1,
  },
  notificationTitleUnread: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#42A5F5',
    marginLeft: 8,
  },
  notificationBody: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 8,
    lineHeight: 20,
  },
  notificationDate: {
    fontSize: 12,
    color: '#64748B',
  },
  deleteButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonText: {
    fontSize: 20,
    color: '#94A3B8',
    lineHeight: 20,
  },
});
