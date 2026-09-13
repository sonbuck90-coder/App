import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  ImageBackground,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { useCustomization } from '../../src/context/CustomizationContext';
import HeaderInfoButton from '../../src/components/HeaderInfoButton';
import AppLogo from '../../src/components/AppLogo';
import { dashboardApi, accountsApi, notificationsApi, Account, DashboardStats } from '../../src/services/api';
import { getLayoutFor, getBankTheme } from '../../src/context/BankThemes';
import HomeModern from '../../src/screens/HomeModern';
import HomeMinimal from '../../src/screens/HomeMinimal';
import HomeLloyds from '../../src/screens/HomeLloyds';

/**
 * Home layout chooser — picks Classic / Modern / Minimal / Lloyds based
 * on the active bank theme. Each layout is an entirely different visual
 * design.
 */
export default function Home() {
  const { bankThemeId } = useCustomization();
  const layout = getLayoutFor(bankThemeId);
  // The Lloyds theme has its own bespoke dashboard.
  if (bankThemeId === 'lloyds') return <HomeLloyds />;
  if (layout === 'modern') return <HomeModern />;
  if (layout === 'minimal') return <HomeMinimal />;
  return <HomeClassic />;
}

// -----------------------------------------------------------------------------
// Colours & helpers
// -----------------------------------------------------------------------------
const C = {
  white: '#FFFFFF',
  bg: '#F4F5F7',
  ink: '#1B1B1B',
  midInk: '#4A4A4A',
  mutedInk: '#6E6E6E',
  softLine: '#E9EBEE',
  chipBg: '#F5F6F8',
  greenAccent: '#00847F',
};

const fmt = (n: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n || 0);

const greetingWord = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
};

const nowTime = () =>
  new Date().toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' }).toLowerCase();

// -----------------------------------------------------------------------------
// Classic HSBC-style layout
// -----------------------------------------------------------------------------
function HomeClassic() {
  const { user, refreshUser } = useAuth();
  const { colors: cc, bankThemeId, currentDashboard } = useCustomization();
  const bankName = getBankTheme(bankThemeId).name;
  const router = useRouter();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hideBalance, setHideBalance] = useState(false);

  const fetchData = async () => {
    try {
      const [statsRes, accountsRes, unreadRes] = await Promise.all([
        dashboardApi.getStats(),
        accountsApi.getAll(),
        notificationsApi.getUnreadCount(),
      ]);
      setStats(statsRes.data);
      setAccounts(accountsRes.data);
      setUnreadCount(unreadRes.data.count);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
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
        <ActivityIndicator size="large" color={cc.primary} />
      </SafeAreaView>
    );
  }

  const firstName = user?.name?.split(' ')[0] || 'there';
  const totalBalance = stats?.total_balance || 0;

  // ---------------------------------------------------------------------------
  // Header icon (with label underneath) — mirrors HSBC mobile app hero icons
  // ---------------------------------------------------------------------------
  const IconWithLabel = ({
    icon,
    label,
    badge,
    onPress,
    testID,
  }: {
    icon: any;
    label: string;
    badge?: number;
    onPress?: () => void;
    testID?: string;
  }) => (
    <TouchableOpacity style={s.iconBtn} onPress={onPress} testID={testID} activeOpacity={0.7}>
      <View>
        <Ionicons name={icon} size={22} color={C.ink} />
        {badge && badge > 0 ? (
          <View style={[s.iconBadge, { backgroundColor: cc.primary }]}>
            <Text style={s.iconBadgeText}>{badge > 9 ? '9+' : String(badge)}</Text>
          </View>
        ) : null}
      </View>
      <Text style={s.iconLabel}>{label}</Text>
    </TouchableOpacity>
  );

  // Quick-action tile
  const QuickTile = ({
    icon,
    label,
    onPress,
    testID,
  }: {
    icon: any;
    label: string;
    onPress?: () => void;
    testID?: string;
  }) => (
    <TouchableOpacity style={s.tile} onPress={onPress} testID={testID} activeOpacity={0.7}>
      <View style={[s.tileIcon, { backgroundColor: `${cc.primary}12` }]}>
        <Ionicons name={icon} size={22} color={cc.primary} />
      </View>
      <Text style={s.tileLabel} numberOfLines={2}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  // HSBC-style diamond motif watermark for the balance card
  const DiamondMotif = () => (
    <View style={s.diamondWrap} pointerEvents="none">
      {[0, 1, 2].map((row) => (
        <View key={row} style={{ flexDirection: 'row' }}>
          {[0, 1, 2, 3].map((col) => {
            const filled = (row + col) % 2 === 0;
            return (
              <View
                key={col}
                style={[
                  s.diamond,
                  {
                    backgroundColor: filled ? `${cc.primary}22` : 'transparent',
                    borderColor: `${cc.primary}66`,
                    borderWidth: filled ? 0 : 1,
                  },
                ]}
              />
            );
          })}
        </View>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={cc.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* -------- Top brand row + labeled icons -------- */}
        <View style={s.topBar}>
          <View style={s.topBarLeft}>
            <AppLogo variant="header" />
          </View>
          <View style={s.topBarRight}>
            <IconWithLabel
              icon="search-outline"
              label="Search"
              onPress={() => router.push('/transactions')}
              testID="home-search"
            />
            <IconWithLabel
              icon="notifications-outline"
              label="Alerts"
              badge={unreadCount}
              onPress={() => router.push('/notifications')}
              testID="home-alerts"
            />
            {/* Info button doubles as the "Menu" affordance and hosts user switching */}
            <View style={s.iconBtn}>
              <HeaderInfoButton tint={C.ink} size={22} />
              <Text style={s.iconLabel}>Menu</Text>
            </View>
          </View>
        </View>

        {/* -------- Greeting -------- */}
        <View style={s.greetBlock}>
          <Text style={s.greetLine}>
            {greetingWord()}, <Text style={s.greetName}>{firstName}</Text>
          </Text>
          <Text style={s.greetSub}>Last logged on: Today at {nowTime()}</Text>
        </View>

        {/* -------- Total balance card with diamond motif -------- */}
        <View style={s.balanceCard}>
          <DiamondMotif />
          <View style={s.balanceCardTop}>
            <Text style={s.balanceCardTitle}>Your accounts</Text>
            <TouchableOpacity
              onPress={() => router.push('/add-money')}
              testID="home-add-money"
              activeOpacity={0.7}
            >
              <Text style={[s.balanceCardLink, { color: cc.primary }]}>Add money ›</Text>
            </TouchableOpacity>
          </View>
          <Text style={s.balanceLabel}>Balance</Text>
          <Text style={s.balanceAmount}>{hideBalance ? '£••••••' : fmt(totalBalance)}</Text>
          <TouchableOpacity
            style={s.hideRow}
            onPress={() => setHideBalance((h) => !h)}
            activeOpacity={0.7}
            testID="home-hide-balance"
          >
            <Ionicons
              name={hideBalance ? 'eye-off-outline' : 'eye-outline'}
              size={16}
              color={C.mutedInk}
            />
            <Text style={s.hideText}>{hideBalance ? 'Show balance' : 'Hide balance'}</Text>
          </TouchableOpacity>
        </View>

        {/* -------- Quick actions -------- */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Quick actions</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/transfers')}>
            <Text style={[s.sectionLink, { color: cc.primary }]}>Manage</Text>
          </TouchableOpacity>
        </View>
        <View style={s.tileRow}>
          <QuickTile
            icon="swap-horizontal"
            label={'Pay &\ntransfer'}
            onPress={() => router.push('/(tabs)/transfers')}
            testID="qa-pay-transfer"
          />
          <QuickTile
            icon="person-outline"
            label={'Send to\npayee'}
            onPress={() => router.push('/payees')}
            testID="qa-payees"
          />
          <QuickTile
            icon="arrow-down-outline"
            label={'Receive\nmoney'}
            onPress={() => router.push('/incoming-transfer')}
            testID="qa-receive"
          />
          <QuickTile
            icon="card-outline"
            label={'Manage\ncards'}
            onPress={() => router.push('/(tabs)/cards')}
            testID="qa-cards"
          />
        </View>

        {/* -------- Widgets -------- */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Widgets</Text>
          <TouchableOpacity onPress={() => router.push('/customization')}>
            <Text style={[s.sectionLink, { color: cc.primary }]}>Edit</Text>
          </TouchableOpacity>
        </View>
        <View style={s.tileRow}>
          <QuickTile
            icon="globe-outline"
            label={'International\nservices'}
            onPress={() => router.push('/international-transfer')}
            testID="widget-intl"
          />
          <QuickTile
            icon="document-text-outline"
            label={'Statements\n& documents'}
            onPress={() => router.push('/statements')}
            testID="widget-statements"
          />
          <QuickTile
            icon="pie-chart-outline"
            label={'Spending\ninsights'}
            onPress={() => router.push('/analytics')}
            testID="widget-insights"
          />
          <QuickTile
            icon="calendar-outline"
            label={'Scheduled\npayments'}
            onPress={() => router.push('/schedules')}
            testID="widget-schedules"
          />
        </View>

        {/* -------- Spending this month (prominent card) -------- */}
        <TouchableOpacity
          style={s.spendCard}
          onPress={() => router.push('/analytics')}
          activeOpacity={0.85}
          testID="home-spending-card"
        >
          <View style={{ flex: 1 }}>
            <Text style={s.spendLabel}>SPENDING THIS MONTH</Text>
            <Text style={s.spendAmount}>{fmt(stats?.monthly_spending || 0)}</Text>
            <Text style={s.spendSub}>Tap to see full breakdown</Text>
          </View>
          <View style={[s.spendIconWrap, { backgroundColor: `${cc.primary}18` }]}>
            <Ionicons name="trending-down" size={26} color={cc.primary} />
          </View>
        </TouchableOpacity>

        {/* -------- Accounts -------- */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Accounts</Text>
          <TouchableOpacity onPress={() => router.push('/transactions')}>
            <Text style={[s.sectionLink, { color: cc.primary }]}>View all</Text>
          </TouchableOpacity>
        </View>
        <View style={{ paddingHorizontal: 16 }}>
          {accounts.map((acc) => {
            const isChecking = acc.account_type === 'checking';
            const barColor = isChecking ? cc.primary : C.greenAccent;
            const label = isChecking ? 'Current Account' : 'Savings Account';
            const acctFormatted = acc.account_number.replace(/(\d{4})(\d+)/, '$1 $2');
            return (
              <TouchableOpacity
                key={acc.id}
                style={[s.acctCard, { borderLeftWidth: 4, borderLeftColor: barColor }]}
                onPress={() => router.push({ pathname: '/transactions', params: { account_id: acc.id } })}
                activeOpacity={0.7}
                testID={`acct-card-${acc.account_type}`}
              >
                <View style={s.acctBody}>
                  <View style={s.acctTopRow}>
                    <Text style={s.acctName}>{label}</Text>
                    <TouchableOpacity
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      onPress={() =>
                        router.push({ pathname: '/transactions', params: { account_id: acc.id } })
                      }
                    >
                      <Ionicons name="ellipsis-horizontal" size={20} color={C.mutedInk} />
                    </TouchableOpacity>
                  </View>
                  <Text style={s.acctMeta}>
                    {acc.sort_code || '00-00-00'}   {acctFormatted}
                  </Text>
                  <View style={s.acctBottomRow}>
                    <View>
                      <Text style={s.acctBalLabel}>Available balance</Text>
                      <Text style={s.acctBalAmount}>{fmt(acc.balance)}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={22} color={C.mutedInk} />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* -------- Recent activity (kept for parity) -------- */}
        {stats?.recent_transactions && stats.recent_transactions.length > 0 && (
          <>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Recent activity</Text>
              <TouchableOpacity onPress={() => router.push('/transactions')}>
                <Text style={[s.sectionLink, { color: cc.primary }]}>View all</Text>
              </TouchableOpacity>
            </View>
            <View style={s.txnList}>
              {stats.recent_transactions.slice(0, 4).map((t, i, arr) => (
                <TouchableOpacity
                  key={t.id}
                  style={[s.txnRow, i < arr.length - 1 && s.txnRowBorder]}
                  onPress={() => router.push({ pathname: '/transaction-detail', params: { id: t.id } })}
                  activeOpacity={0.7}
                >
                  <View style={[s.txnIcon, { backgroundColor: `${cc.primary}10` }]}>
                    <Ionicons
                      name={t.transaction_type === 'deposit' ? 'arrow-down' : 'arrow-forward'}
                      size={16}
                      color={cc.primary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.txnName} numberOfLines={1}>
                      {t.recipient_name || t.description}
                    </Text>
                    <Text style={s.txnDate}>
                      {new Date(t.timestamp).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                      })}
                    </Text>
                  </View>
                  <Text
                    style={[
                      s.txnAmt,
                      t.transaction_type === 'deposit' && { color: C.greenAccent },
                    ]}
                  >
                    {t.transaction_type === 'deposit' ? '+' : '−'} {fmt(t.amount)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <Text style={s.footer}>{bankName} UK plc • FCA-regulated</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  loading: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },

  // -------- top bar --------
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: C.white,
  },
  topBarLeft: { flexDirection: 'row', alignItems: 'center', paddingTop: 8 },
  topBarRight: { flexDirection: 'row', alignItems: 'flex-start' },
  iconBtn: {
    alignItems: 'center',
    marginLeft: 18,
    paddingVertical: 4,
    width: 54,
  },
  iconLabel: {
    fontSize: 10,
    color: C.midInk,
    marginTop: 4,
    fontWeight: '500',
  },
  iconBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    borderRadius: 9,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  iconBadgeText: { color: C.white, fontSize: 9, fontWeight: '700' },

  // -------- greeting --------
  greetBlock: {
    backgroundColor: C.white,
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 6,
  },
  greetLine: { fontSize: 22, fontWeight: '400', color: C.ink },
  greetName: { fontWeight: '700', color: C.ink },
  greetSub: { fontSize: 12, color: C.mutedInk, marginTop: 4 },

  // -------- balance card --------
  balanceCard: {
    backgroundColor: C.white,
    marginHorizontal: 16,
    marginTop: 8,
    padding: 20,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.softLine,
  },
  balanceCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceCardTitle: { fontSize: 15, fontWeight: '700', color: C.ink },
  balanceCardLink: { fontSize: 14, fontWeight: '600' },
  balanceLabel: { fontSize: 12, color: C.mutedInk, marginTop: 12 },
  balanceAmount: {
    fontSize: 38,
    fontWeight: '700',
    color: C.ink,
    marginTop: 4,
    letterSpacing: -1,
  },
  hideRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  hideText: { fontSize: 13, color: C.mutedInk, marginLeft: 6, fontWeight: '500' },
  diamondWrap: {
    position: 'absolute',
    right: -12,
    top: -8,
    transform: [{ rotate: '45deg' }],
    opacity: 0.9,
  },
  diamond: {
    width: 18,
    height: 18,
    margin: 2,
  },

  // -------- section header --------
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 24,
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: C.ink },
  sectionLink: { fontSize: 14, fontWeight: '600' },

  // -------- tile row --------
  tileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  tile: {
    flex: 1,
    marginHorizontal: 4,
    backgroundColor: C.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.softLine,
    paddingVertical: 14,
    paddingHorizontal: 6,
    alignItems: 'center',
    minHeight: 96,
  },
  tileIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  tileLabel: {
    fontSize: 11,
    color: C.ink,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 14,
  },

  // -------- spending card --------
  spendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.white,
    marginHorizontal: 16,
    marginTop: 20,
    padding: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.softLine,
  },
  spendLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.mutedInk,
    letterSpacing: 1,
  },
  spendAmount: {
    fontSize: 28,
    fontWeight: '800',
    color: C.ink,
    marginTop: 6,
    letterSpacing: -0.5,
  },
  spendSub: {
    fontSize: 12,
    color: C.mutedInk,
    marginTop: 4,
  },
  spendIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 14,
  },

  // -------- accounts --------
  acctCard: {
    backgroundColor: C.white,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.softLine,
    overflow: 'hidden',
    paddingLeft: 14,
    paddingRight: 14,
    paddingVertical: 14,
  },
  acctBody: {
    // holds all three rows for a clean vertical layout
  },
  acctTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  acctBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 10,
  },
  acctName: { fontSize: 15, fontWeight: '700', color: C.ink },
  acctMeta: { fontSize: 12, color: C.mutedInk, marginTop: 4, letterSpacing: 0.3 },
  acctBalLabel: { fontSize: 12, color: C.mutedInk },
  acctBalAmount: { fontSize: 22, fontWeight: '700', color: C.ink, marginTop: 2 },

  // -------- transactions --------
  txnList: {
    backgroundColor: C.white,
    marginHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.softLine,
    overflow: 'hidden',
  },
  txnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  txnRowBorder: { borderBottomWidth: 1, borderBottomColor: C.softLine },
  txnIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  txnName: { fontSize: 14, fontWeight: '600', color: C.ink },
  txnDate: { fontSize: 12, color: C.mutedInk, marginTop: 2 },
  txnAmt: { fontSize: 14, fontWeight: '700', color: C.ink },

  footer: {
    textAlign: 'center',
    fontSize: 11,
    color: C.mutedInk,
    marginTop: 24,
    marginBottom: 8,
  },
});
