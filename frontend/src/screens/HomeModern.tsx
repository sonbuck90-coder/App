/**
 * Modern home layout — used for fintech-style banks (Monzo, Starling, Revolut).
 *
 * Aesthetic: dark hero with a large balance, rounded pill action buttons,
 * vibrant accent transactions, account tiles with chunky rounded corners.
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

const fmt = (a: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(a);

export default function HomeModern() {
  const { user, refreshUser } = useAuth();
  const { colors: cc } = useCustomization();
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
      setStats(s.data);
      setAccounts(a.data);
      setUnread(u.data.count);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  useFocusEffect(useCallback(() => { load(); refreshUser(); }, []));

  if (loading) {
    return (
      <View style={[s.darkBg, { backgroundColor: cc.primary }]}>
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );
  }

  const total = stats?.total_balance || 0;

  return (
    <View style={[s.root, { backgroundColor: cc.primary }]}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 40 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor="#FFFFFF"
              onRefresh={() => { setRefreshing(true); load(); }}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Hero */}
          <View style={s.hero}>
            <View style={s.heroTopRow}>
              <View>
                <Text style={s.greet}>Welcome back</Text>
                <Text style={s.greetName}>{user?.name || 'You'}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <TouchableOpacity onPress={() => router.push('/chat')} style={s.iconBtn} testID="home-chat">
                  <Ionicons name="chatbubbles-outline" size={22} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.push('/notifications' as any)} style={s.iconBtn}>
                  <Ionicons name="notifications-outline" size={22} color="#fff" />
                  {unread > 0 && (
                    <View style={[s.unreadDot, { backgroundColor: cc.accent }]} />
                  )}
                </TouchableOpacity>
              </View>
            </View>
            <Text style={s.balanceLabel}>TOTAL BALANCE</Text>
            <Text style={s.balanceAmount}>{fmt(total)}</Text>
            <Text style={[s.balanceSub, { color: cc.accent }]}>↑ across {accounts.length} accounts</Text>

            {/* Pill actions */}
            <View style={s.pillRow}>
              {[
                { icon: 'arrow-up', label: 'Send', onPress: () => router.push('/(tabs)/transfers') },
                { icon: 'add', label: 'Add', onPress: () => router.push('/add-money') },
                { icon: 'swap-horizontal', label: 'Move', onPress: () => router.push('/move-money') },
                { icon: 'card', label: 'Cards', onPress: () => router.push('/(tabs)/cards') },
              ].map((a) => (
                <TouchableOpacity key={a.label} style={s.pill} onPress={a.onPress}>
                  <View style={[s.pillIcon, { backgroundColor: cc.accent }]}>
                    <Ionicons name={a.icon as any} size={20} color="#FFFFFF" />
                  </View>
                  <Text style={s.pillLabel}>{a.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Accounts as chunky cards */}
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>Your accounts</Text>
            {accounts.map((acc, idx) => (
              <TouchableOpacity
                key={acc.id}
                style={[s.acctCard, { backgroundColor: idx === 0 ? cc.accent : '#F1F3F7' }]}
                onPress={() => router.push('/transactions' as any)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[s.acctType, { color: idx === 0 ? '#FFFFFF' : '#5E6A7A' }]}>
                    {acc.account_type === 'checking' ? 'CURRENT' : 'SAVINGS'} · {acc.account_number.slice(-4)}
                  </Text>
                  <Text style={[s.acctBalance, { color: idx === 0 ? '#FFFFFF' : '#0B1424' }]}>{fmt(acc.balance)}</Text>
                  <Text style={[s.acctSort, { color: idx === 0 ? 'rgba(255,255,255,0.85)' : '#8893A3' }]}>Sort {acc.sort_code}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={idx === 0 ? '#FFFFFF' : '#8893A3'} />
              </TouchableOpacity>
            ))}

            <Text style={[s.sheetTitle, { marginTop: 24 }]}>Recent activity</Text>
            {(stats?.recent_transactions || []).slice(0, 6).map((t: any) => {
              const isIn = t.transaction_type === 'deposit';
              return (
                <TouchableOpacity
                  key={t.id}
                  style={s.txnRow}
                  onPress={() => router.push({ pathname: '/transaction-detail', params: { id: t.id } } as any)}
                >
                  <View style={[s.txnIcon, { backgroundColor: isIn ? `${cc.accent}22` : '#F1F3F7' }]}>
                    <Ionicons
                      name={isIn ? 'arrow-down' : t.transaction_type === 'payment' ? 'receipt-outline' : 'arrow-up'}
                      size={18}
                      color={isIn ? cc.accent : '#0B1424'}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.txnTitle} numberOfLines={1}>{t.description}</Text>
                    <Text style={s.txnSub}>{t.recipient_name || ''}</Text>
                  </View>
                  <Text style={[s.txnAmt, isIn ? { color: cc.accent } : undefined]}>{isIn ? '+' : '−'} {fmt(t.amount)}</Text>
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity style={s.viewAll} onPress={() => router.push('/transactions' as any)}>
              <Text style={[s.viewAllText, { color: cc.primary }]}>View all transactions  →</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  darkBg: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero: { paddingHorizontal: 22, paddingTop: 8, paddingBottom: 28 },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 },
  greet: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '500' },
  greetName: { color: '#FFFFFF', fontSize: 22, fontWeight: '700', marginTop: 2 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  unreadDot: { position: 'absolute', top: 9, right: 9, width: 8, height: 8, borderRadius: 4 },
  balanceLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 11, letterSpacing: 1.2, fontWeight: '700' },
  balanceAmount: { color: '#FFFFFF', fontSize: 42, fontWeight: '800', marginTop: 6, letterSpacing: -0.5 },
  balanceSub: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  pillRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 24 },
  pill: { alignItems: 'center' },
  pillIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  pillLabel: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8, minHeight: 400 },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: '#0B1424', marginBottom: 14 },
  acctCard: { flexDirection: 'row', alignItems: 'center', padding: 18, borderRadius: 18, marginBottom: 10 },
  acctType: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  acctBalance: { fontSize: 24, fontWeight: '800', marginTop: 6, letterSpacing: -0.3 },
  acctSort: { fontSize: 11, marginTop: 4, fontWeight: '600' },
  txnRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  txnIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  txnTitle: { fontSize: 14, fontWeight: '600', color: '#0B1424' },
  txnSub: { fontSize: 12, color: '#8893A3', marginTop: 2 },
  txnAmt: { fontSize: 14, fontWeight: '700', color: '#0B1424' },
  viewAll: { paddingVertical: 18, alignItems: 'center' },
  viewAllText: { fontSize: 14, fontWeight: '700' },
});
