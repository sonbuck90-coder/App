import React, { useState, useCallback } from 'react';
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
import HeaderInfoButton from '../components/HeaderInfoButton';
import {
  dashboardApi,
  accountsApi,
  notificationsApi,
  Account,
  DashboardStats,
} from '../services/api';

/**
 * HomeLloyds — Lloyds-inspired dashboard.
 *
 * Layout mirrors the official Lloyds mobile app: a compact header ("Hi
 * {name}" with mail and help icons), a black-pill segmented control
 * (Summary / Everyday / Save & Invest / Borrowing), account cards with big
 * bold balances, and green promo cards for cross-sell.
 */

// -- palette ------------------------------------------------------------------
const P = {
  bg: '#F5F5F5',
  cardBg: '#FFFFFF',
  ink: '#0B0B0B',
  midInk: '#3A3A3A',
  softInk: '#6B6B6B',
  divider: '#E5E5E5',
  green: '#0A7E3F',   // Lloyds green (primary CTA)
  greenSoft: '#5FCB80', // promo card background
  black: '#000000',
};

// -- helpers ------------------------------------------------------------------
const gbp = (n: number) =>
  new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

/**
 * Split "1245.27" into ["£1,245", ".27"] so the pence can render in a
 * smaller Text — Lloyds' signature amount treatment.
 */
const splitAmount = (n: number): [string, string] => {
  const [whole, frac] = gbp(n).split('.');
  return [`£${whole}`, `.${frac}`];
};

type Tab = 'summary' | 'everyday' | 'save' | 'borrow';

export default function HomeLloyds() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeTab, setActiveTab] = useState<Tab>('everyday');

  const fetchData = async () => {
    try {
      const [s1, s2, s3] = await Promise.all([
        dashboardApi.getStats(),
        accountsApi.getAll(),
        notificationsApi.getUnreadCount(),
      ]);
      setStats(s1.data);
      setAccounts(s2.data);
      setUnreadCount(s3.data.count);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
      refreshUser();
    }, [])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, []);

  if (isLoading) {
    return (
      <SafeAreaView style={s.loading}>
        <ActivityIndicator size="large" color={P.green} />
      </SafeAreaView>
    );
  }

  const firstName = user?.name?.split(' ')[0] || 'there';
  const checking = accounts.find((a) => a.account_type === 'checking') || accounts[0];
  const savings = accounts.find((a) => a.account_type === 'savings');

  // -- pill tabs ---------------------------------------------------------------
  const TABS: { id: Tab; label: string }[] = [
    { id: 'summary', label: 'Summary' },
    { id: 'everyday', label: 'Everyday' },
    { id: 'save', label: 'Save & Invest' },
    { id: 'borrow', label: 'Borrowing' },
  ];

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={P.green} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ---------- Header ---------- */}
        <View style={s.header}>
          <TouchableOpacity
            style={s.headerBtn}
            onPress={() => router.push('/notifications')}
            testID="lloyds-mail"
            activeOpacity={0.7}
          >
            <Ionicons name="mail-outline" size={22} color={P.ink} />
            {unreadCount > 0 && (
              <View style={[s.headerBadge, { backgroundColor: P.green }]}>
                <Text style={s.headerBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <Text style={s.headerTitle}>Hi {firstName}</Text>
          <View style={s.headerRightGroup}>
            <TouchableOpacity
              style={s.headerBtn}
              onPress={() => router.push('/chat')}
              testID="lloyds-help"
              activeOpacity={0.7}
            >
              <Ionicons name="help-circle-outline" size={22} color={P.ink} />
            </TouchableOpacity>
            <View style={s.headerBtn}>
              <HeaderInfoButton tint={P.ink} size={22} />
            </View>
          </View>
        </View>

        {/* ---------- Pill tabs ---------- */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.tabsRow}
        >
          {TABS.map((t) => {
            const active = t.id === activeTab;
            return (
              <TouchableOpacity
                key={t.id}
                onPress={() => setActiveTab(t.id)}
                style={[
                  s.tab,
                  active ? { backgroundColor: P.black, borderColor: P.black } : { borderColor: P.divider },
                ]}
                activeOpacity={0.8}
                testID={`lloyds-tab-${t.id}`}
              >
                <Text style={[s.tabText, { color: active ? '#FFFFFF' : P.ink }]}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ---------- Current accounts ---------- */}
        <Text style={s.sectionTitle}>Current accounts</Text>

        {checking && (
          <View style={s.acctCard}>
            <View style={s.acctHeadRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.acctName}>Classic account</Text>
                <Text style={s.acctMeta}>{checking.sort_code || '00-00-00'}   /   {checking.account_number}</Text>
              </View>
              <TouchableOpacity
                onPress={() => router.push({ pathname: '/transactions', params: { account_id: checking.id } })}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                testID="lloyds-acct-more"
              >
                <Ionicons name="ellipsis-horizontal" size={22} color={P.ink} />
              </TouchableOpacity>
            </View>
            <View style={s.amountRow}>
              <Text style={s.amountWhole}>{splitAmount(checking.balance)[0]}</Text>
              <Text style={s.amountFrac}>{splitAmount(checking.balance)[1]}</Text>
            </View>
            <Text style={s.amountSub}>Available overdraft: £200.00</Text>

            <View style={s.actionButtonRow}>
              <TouchableOpacity
                style={s.actionButton}
                onPress={() => router.push('/(tabs)/transfers')}
                activeOpacity={0.75}
                testID="lloyds-pay-transfer"
              >
                <Text style={s.actionButtonText}>Pay &amp; transfer</Text>
              </TouchableOpacity>
              <View style={s.actionDivider} />
              <TouchableOpacity
                style={s.actionButton}
                onPress={() => router.push('/schedules')}
                activeOpacity={0.75}
                testID="lloyds-regular"
              >
                <Text style={s.actionButtonText}>Regular payments</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ---------- Green promo card ---------- */}
        <TouchableOpacity
          style={s.promoCard}
          onPress={() => router.push('/analytics')}
          activeOpacity={0.9}
          testID="lloyds-promo-budget"
        >
          <View style={s.promoIcon}>
            <Ionicons name="calendar" size={28} color={P.black} />
          </View>
          <Text style={s.promoTitle}>Budget for bill changes</Text>
          <Text style={s.promoBody}>
            {`Your Direct Debit to Virgin Media has\nincreased by £${((stats?.monthly_spending || 50) * 0.02).toFixed(2)}`}
          </Text>
          <View style={s.promoCtaRow}>
            <Text style={s.promoCtaText}>Find out more</Text>
            <View style={s.promoCtaCircle}>
              <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
            </View>
          </View>
        </TouchableOpacity>

        {/* ---------- Savings ---------- */}
        {savings && (
          <>
            <Text style={s.sectionTitle}>Savings</Text>
            <View style={s.acctCard}>
              <View style={s.acctHeadRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.acctName}>Easy Saver</Text>
                  <Text style={s.acctMeta}>{savings.sort_code || '00-00-00'}   /   {savings.account_number}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => router.push({ pathname: '/transactions', params: { account_id: savings.id } })}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="ellipsis-horizontal" size={22} color={P.ink} />
                </TouchableOpacity>
              </View>
              <View style={s.amountRow}>
                <Text style={s.amountWhole}>{splitAmount(savings.balance)[0]}</Text>
                <Text style={s.amountFrac}>{splitAmount(savings.balance)[1]}</Text>
              </View>
            </View>
          </>
        )}

        {/* ---------- Second promo card ---------- */}
        <TouchableOpacity
          style={[s.promoCard, { marginTop: 8 }]}
          onPress={() => router.push('/chat')}
          activeOpacity={0.9}
          testID="lloyds-promo-scam"
        >
          <View style={s.promoIcon}>
            <Ionicons name="warning" size={28} color={P.black} />
          </View>
          <Text style={s.promoTitle}>Invoice scams</Text>
          <Text style={s.promoBody}>
            Fraudsters can falsify invoices. Always confirm new payment details with your supplier.
          </Text>
          <View style={s.promoCtaRow}>
            <Text style={s.promoCtaText}>Find out more</Text>
            <View style={s.promoCtaCircle}>
              <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
            </View>
          </View>
        </TouchableOpacity>

        <Text style={s.footer}>Lloyds Bank plc • FCA-regulated</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// -----------------------------------------------------------------------------
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.bg },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: P.bg },
  scroll: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRightGroup: { flexDirection: 'row' },
  headerTitle: { fontSize: 17, fontWeight: '600', color: P.ink },
  headerBadge: {
    position: 'absolute',
    top: 6,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '700' },

  tabsRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  tab: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  tabText: { fontSize: 14, fontWeight: '600' },

  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: P.ink,
    paddingHorizontal: 16,
    marginTop: 12,
    marginBottom: 12,
  },

  acctCard: {
    marginHorizontal: 16,
    padding: 18,
    backgroundColor: P.cardBg,
    borderRadius: 10,
    marginBottom: 12,
  },
  acctHeadRow: { flexDirection: 'row', alignItems: 'flex-start' },
  acctName: { fontSize: 15, fontWeight: '800', color: P.ink },
  acctMeta: { fontSize: 12, color: P.softInk, marginTop: 4, letterSpacing: 0.2 },

  amountRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 14 },
  amountWhole: { fontSize: 32, fontWeight: '800', color: P.ink, letterSpacing: -0.5 },
  amountFrac: { fontSize: 18, fontWeight: '700', color: P.ink, marginBottom: 3 },
  amountSub: { fontSize: 13, color: P.softInk, marginTop: 4 },

  actionButtonRow: {
    flexDirection: 'row',
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: P.divider,
    paddingTop: 12,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
  },
  actionButtonText: { fontSize: 14, fontWeight: '700', color: P.ink },
  actionDivider: { width: 1, backgroundColor: P.divider },

  promoCard: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 20,
    borderRadius: 10,
    backgroundColor: P.greenSoft,
    marginBottom: 12,
  },
  promoIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  promoTitle: { fontSize: 17, fontWeight: '800', color: P.black, marginBottom: 6 },
  promoBody: { fontSize: 14, color: P.black, lineHeight: 20, opacity: 0.9 },
  promoCtaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  promoCtaText: { fontSize: 14, fontWeight: '700', color: P.black, marginRight: 8 },
  promoCtaCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: P.black,
    alignItems: 'center',
    justifyContent: 'center',
  },

  footer: {
    textAlign: 'center',
    fontSize: 11,
    color: P.softInk,
    marginTop: 24,
  },
});
