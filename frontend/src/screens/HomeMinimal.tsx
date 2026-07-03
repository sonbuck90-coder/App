/**
 * Minimal home layout — airy light style used by Barclays.
 *
 * Aesthetic: lots of whitespace, large light-weight typography, thin dividers,
 * full-width pill action buttons, simple stacked transaction rows.
 */
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { useCustomization } from '../context/CustomizationContext';
import { dashboardApi, accountsApi, notificationsApi, Account, DashboardStats } from '../services/api';
import HeaderInfoButton from '../components/HeaderInfoButton';

const fmt = (a: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(a);

export default function HomeMinimal() {
  const { user, refreshUser } = useAuth();
  const { colors: cc, headerTextColor } = useCustomization();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [unread, setUnread] = useState(0);

  const load = async () => {
    try {
      const [s, a, u] = await Promise.all([
        dashboardApi.getStats(),
        accountsApi.getAll(),
        notificationsApi.getUnreadCount(),
      ]);
      setStats(s.data); setAccounts(a.data); setUnread(u.data.count);
    } catch { /* ignore */ }
    finally { setLoading(false); setRefreshing(false); }
  };
  useFocusEffect(useCallback(() => { load(); refreshUser(); }, []));

  if (loading) {
    return <View style={s.center}><ActivityIndicator color={cc.primary} size="large" /></View>;
  }

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Coloured header strip */}
        <View style={[s.headerStrip, { backgroundColor: cc.header }]}>
          <View style={s.headerRow}>
            <Text style={[s.bigGreeting, { color: headerTextColor }]} numberOfLines={1}>Hi {user?.name?.split(' ')[0] || 'there'}</Text>
            <View style={{ flexDirection: 'row', gap: 14 }}>
              <TouchableOpacity onPress={() => router.push('/chat')} style={[s.headerBtn, { borderColor: headerTextColor + '55' }]}>
                <Ionicons name="chatbubble-ellipses-outline" size={18} color={headerTextColor} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push('/notifications' as any)} style={[s.headerBtn, { borderColor: headerTextColor + '55' }]}>
                <Ionicons name="notifications-outline" size={18} color={headerTextColor} />
                {unread > 0 && <View style={[s.unreadDot, { backgroundColor: cc.accent }]} />}
              </TouchableOpacity>
              <HeaderInfoButton tint={headerTextColor} size={22} />
            </View>
          </View>
          <Text style={[s.headerLabel, { color: headerTextColor, opacity: 0.7 }]}>YOUR MONEY</Text>
          <Text style={[s.headerBalance, { color: headerTextColor }]}>{fmt(stats?.total_balance || 0)}</Text>
          <Text style={[s.headerSub, { color: headerTextColor, opacity: 0.75 }]}>across {accounts.length} accounts</Text>
        </View>

        {/* Full-width pill actions */}
        <View style={s.actions}>
          {[
            { icon: 'send-outline', label: 'Send money', onPress: () => router.push('/(tabs)/transfers') },
            { icon: 'arrow-down-circle-outline', label: 'Receive money', onPress: () => router.push('/incoming-transfer') },
            { icon: 'add-circle-outline', label: 'Add money', onPress: () => router.push('/add-money') },
            { icon: 'card-outline', label: 'My cards', onPress: () => router.push('/(tabs)/cards') },
            { icon: 'globe-outline', label: 'International', onPress: () => router.push('/international-transfer') },
          ].map((a) => (
            <TouchableOpacity key={a.label} style={s.pillAction} onPress={a.onPress}>
              <Ionicons name={a.icon as any} size={20} color={cc.primary} />
              <Text style={[s.pillLabel, { color: cc.primary }]}>{a.label}</Text>
              <Ionicons name="chevron-forward" size={18} color="#C5CBD3" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Accounts — clean list with thin separators */}
        <Text style={s.sectionTitle}>Accounts</Text>
        <View style={s.list}>
          {accounts.map((acc, i) => (
            <TouchableOpacity
              key={acc.id}
              style={[s.acctRow, i < accounts.length - 1 && { borderBottomWidth: 1, borderBottomColor: '#EFF1F4' }]}
              onPress={() => router.push('/transactions' as any)}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.acctName}>{acc.account_type === 'checking' ? 'Current Account' : 'Savings Account'}</Text>
                <Text style={s.acctMeta}>{acc.sort_code} · ****{acc.account_number.slice(-4)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={s.acctBal}>{fmt(acc.balance)}</Text>
                <Text style={s.acctAvail}>Available</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#C5CBD3" style={{ marginLeft: 8 }} />
            </TouchableOpacity>
          ))}
        </View>

        <View style={s.sectionHeaderRow}>
          <Text style={s.sectionTitle}>Recent activity</Text>
          <TouchableOpacity onPress={() => router.push('/transactions' as any)}>
            <Text style={[s.linkText, { color: cc.primary }]}>See all</Text>
          </TouchableOpacity>
        </View>
        <View style={s.list}>
          {(stats?.recent_transactions || []).slice(0, 6).map((t: any, i: number) => {
            const isIn = t.transaction_type === 'deposit';
            return (
              <TouchableOpacity
                key={t.id}
                style={[s.txnRow, i < 5 && { borderBottomWidth: 1, borderBottomColor: '#EFF1F4' }]}
                onPress={() => router.push({ pathname: '/transaction-detail', params: { id: t.id } } as any)}
              >
                <View style={[s.txnInitial, { backgroundColor: `${cc.primary}12` }]}>
                  <Text style={[s.txnInitialText, { color: cc.primary }]}>
                    {(t.recipient_name || t.description || '?').trim().charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.txnTitle} numberOfLines={1}>{t.description}</Text>
                  <Text style={s.txnDate}>
                    {new Date(t.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                  </Text>
                </View>
                <Text style={[s.txnAmt, isIn && { color: '#00847F' }]}>{isIn ? '+' : '−'} {fmt(t.amount)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  headerStrip: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 32 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 },
  bigGreeting: { fontSize: 17, fontWeight: '600' },
  headerBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  unreadDot: { position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: 4 },
  headerLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2 },
  headerBalance: { fontSize: 44, fontWeight: '300', marginTop: 6, letterSpacing: -1 },
  headerSub: { fontSize: 12, marginTop: 2 },
  actions: { paddingHorizontal: 20, paddingTop: 24 },
  pillAction: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F7F9FB', paddingHorizontal: 18, paddingVertical: 16, borderRadius: 14, marginBottom: 10 },
  pillLabel: { flex: 1, fontSize: 15, fontWeight: '600', marginLeft: 14 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#5E6A7A', letterSpacing: 0.5, marginHorizontal: 20, marginTop: 26, marginBottom: 10, textTransform: 'uppercase' },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingRight: 20 },
  linkText: { fontSize: 13, fontWeight: '700', marginTop: 26, marginBottom: 10 },
  list: { backgroundColor: '#FFFFFF', marginHorizontal: 16, borderRadius: 14, borderWidth: 1, borderColor: '#EFF1F4', overflow: 'hidden' },
  acctRow: { flexDirection: 'row', alignItems: 'center', padding: 18 },
  acctName: { fontSize: 15, fontWeight: '700', color: '#0B1424' },
  acctMeta: { fontSize: 12, color: '#8893A3', marginTop: 3 },
  acctBal: { fontSize: 17, fontWeight: '700', color: '#0B1424' },
  acctAvail: { fontSize: 11, color: '#8893A3', marginTop: 2 },
  txnRow: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  txnInitial: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  txnInitialText: { fontSize: 15, fontWeight: '800' },
  txnTitle: { fontSize: 14, fontWeight: '600', color: '#0B1424' },
  txnDate: { fontSize: 12, color: '#8893A3', marginTop: 2 },
  txnAmt: { fontSize: 14, fontWeight: '700', color: '#0B1424' },
});
