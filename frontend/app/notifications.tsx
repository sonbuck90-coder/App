import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { notificationsApi, AppNotification } from '../src/services/api';

const COLORS = { primary: '#DB0011', white: '#FFFFFF', lightGray: '#F5F5F5', gray: '#767676', darkGray: '#333333', black: '#000000', success: '#00847F', background: '#F5F5F5' };

const NOTIF_ICONS: { [key: string]: { name: keyof typeof Ionicons.glyphMap; color: string } } = {
  transfer: { name: 'swap-horizontal', color: '#007AFF' },
  payment: { name: 'receipt', color: '#FF9500' },
  card: { name: 'card', color: '#5856D6' },
  welcome: { name: 'gift', color: '#34C759' },
  system: { name: 'information-circle', color: COLORS.gray },
};

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { fetchNotifications(); }, []);

  const fetchNotifications = async () => {
    try {
      const res = await notificationsApi.getAll(50);
      setNotifications(res.data);
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); setRefreshing(false); }
  };

  const onRefresh = useCallback(() => { setRefreshing(true); fetchNotifications(); }, []);

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllRead();
      fetchNotifications();
    } catch (e) { console.error(e); }
  };

  const handleTapNotification = async (notif: AppNotification) => {
    if (!notif.is_read) {
      try { await notificationsApi.markRead(notif.id); } catch (e) {}
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
    }
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  if (isLoading) return <SafeAreaView style={styles.loading}><ActivityIndicator size="large" color={COLORS.primary} /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAllBtn}>
            <Text style={styles.markAllText}>Read All</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {unreadCount > 0 && (
          <View style={styles.unreadBanner}>
            <Ionicons name="mail-unread" size={16} color={COLORS.primary} />
            <Text style={styles.unreadText}>{unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}</Text>
          </View>
        )}

        {notifications.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="notifications-off-outline" size={56} color={COLORS.gray} />
            <Text style={styles.emptyTitle}>No Notifications</Text>
            <Text style={styles.emptySubtext}>You'll see alerts for transfers, payments, and card activity here</Text>
          </View>
        ) : (
          notifications.map((notif, i) => {
            const iconConfig = NOTIF_ICONS[notif.notification_type] || NOTIF_ICONS.system;
            return (
              <TouchableOpacity
                key={notif.id}
                style={[styles.notifCard, !notif.is_read && styles.notifUnread]}
                onPress={() => handleTapNotification(notif)}
                testID={`notification-${notif.id}`}
              >
                <View style={[styles.notifIcon, { backgroundColor: `${iconConfig.color}15` }]}>
                  <Ionicons name={iconConfig.name} size={22} color={iconConfig.color} />
                </View>
                <View style={styles.notifContent}>
                  <View style={styles.notifTop}>
                    <Text style={[styles.notifTitle, !notif.is_read && styles.notifTitleUnread]}>{notif.title}</Text>
                    {!notif.is_read && <View style={styles.unreadDot} />}
                  </View>
                  <Text style={styles.notifBody} numberOfLines={2}>{notif.body}</Text>
                  <Text style={styles.notifTime}>{formatTime(notif.timestamp)}</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loading: { flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' },
  header: { backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' },
  backBtn: { marginRight: 16 },
  headerTitle: { fontSize: 20, fontWeight: '600', color: COLORS.white, flex: 1 },
  markAllBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 16 },
  markAllText: { color: COLORS.white, fontSize: 13, fontWeight: '600' },
  scrollView: { flex: 1 },
  unreadBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF0F0', margin: 16, marginBottom: 8, padding: 12, borderRadius: 8 },
  unreadText: { fontSize: 14, color: COLORS.primary, fontWeight: '500', marginLeft: 8 },
  emptyState: { alignItems: 'center', paddingVertical: 64, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: COLORS.darkGray, marginTop: 16 },
  emptySubtext: { fontSize: 14, color: COLORS.gray, marginTop: 8, textAlign: 'center' },
  notifCard: { flexDirection: 'row', backgroundColor: COLORS.white, marginHorizontal: 16, marginBottom: 8, borderRadius: 8, padding: 16 },
  notifUnread: { borderLeftWidth: 3, borderLeftColor: COLORS.primary },
  notifIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  notifContent: { flex: 1 },
  notifTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  notifTitle: { fontSize: 15, fontWeight: '500', color: COLORS.darkGray, flex: 1 },
  notifTitleUnread: { fontWeight: '700' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary, marginLeft: 8 },
  notifBody: { fontSize: 14, color: COLORS.gray, marginTop: 4, lineHeight: 20 },
  notifTime: { fontSize: 12, color: COLORS.gray, marginTop: 6 },
});
