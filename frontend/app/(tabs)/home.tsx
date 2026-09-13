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
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={cc.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* -------- Hero band (image or gradient fallback) -------- */}
        {currentDashboard ? (
          <ImageBackground source={{ uri: currentDashboard }} style={s.hero} resizeMode="cover">
            <HeroContent
              cc={cc}
              unreadCount={unreadCount}
              router={router}
            />
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.35)']}
              style={s.heroFade}
              pointerEvents="none"
            />
          </ImageBackground>
        ) : (
          <LinearGradient
            colors={['#F4C9B0', '#B8968A', '#4C4643']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={s.hero}
          >
            <HeroContent cc={cc} unreadCount={unreadCount} router={router} />
          </LinearGradient>
        )}

        {/* -------- Your products -------- */}
        <View style={s.productsHead}>
          <Text style={s.productsTitle}>Your products</Text>
          <TouchableOpacity
            style={s.eyeToggle}
            onPress={() => setHideBalance((h) => !h)}
            testID="home-hide-balance"
            activeOpacity={0.7}
          >
            <Ionicons
              name={hideBalance ? 'eye-off' : 'eye'}
              size={20}
              color={C.ink}
            />
          </TouchableOpacity>
        </View>

        <View style={{ paddingHorizontal: 16 }}>
          {accounts.map((acc) => {
            const isChecking = acc.account_type === 'checking';
            const label = isChecking ? 'Current Account' : 'Online Bonus Saver';
            const [whole, frac] = fmt(acc.balance).replace('£', '').split('.');
            return (
              <TouchableOpacity
                key={acc.id}
                style={s.productCard}
                onPress={() =>
                  router.push({ pathname: '/transactions', params: { account_id: acc.id } })
                }
                activeOpacity={0.85}
                testID={`acct-card-${acc.account_type}`}
              >
                <View style={s.productTop}>
                  <View style={[s.hsbcHex, { backgroundColor: cc.primary }]}>
                    <View style={s.hsbcHexInner} />
                  </View>
                  <View style={s.productActions}>
                    <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="star-outline" size={22} color={C.ink} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={{ marginLeft: 12 }}
                    >
                      <Ionicons name="ellipsis-vertical" size={20} color={C.ink} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={s.productBody}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.productName}>{label}</Text>
                    <Text style={s.productMeta}>
                      {acc.sort_code || '00-00-00'} {acc.account_number}
                    </Text>
                  </View>
                  <View style={s.productAmountBlock}>
                    {hideBalance ? (
                      <Text style={s.productAmountWhole}>£••••</Text>
                    ) : (
                      <Text style={s.productAmountWhole}>
                        £{whole}
                        <Text style={s.productAmountFrac}>.{frac}</Text>
                      </Text>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}

          {/* Credit-Card style card (uses first card as a nice-to-have) */}
          <TouchableOpacity
            style={s.productCard}
            onPress={() => router.push('/(tabs)/cards')}
            activeOpacity={0.85}
            testID="acct-card-credit"
          >
            <View style={s.productTop}>
              <View style={[s.hsbcHexSmall, { backgroundColor: cc.primary }]}>
                <View style={s.hsbcHexInnerSmall} />
              </View>
              <View style={s.productActions}>
                <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="star-outline" size={22} color={C.ink} />
                </TouchableOpacity>
                <TouchableOpacity
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={{ marginLeft: 12 }}
                >
                  <Ionicons name="ellipsis-vertical" size={20} color={C.ink} />
                </TouchableOpacity>
              </View>
            </View>
            <View style={s.productBody}>
              <View style={{ flex: 1 }}>
                <Text style={s.productName}>Credit Card</Text>
                <Text style={s.productMeta}>•••• •••• •••• 0000</Text>
              </View>
              <View style={s.productAmountBlock}>
                <Text style={s.productAmountWhole}>
                  £500
                  <Text style={s.productAmountFrac}>.00</Text>
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        <Text style={s.footer}>{bankName} UK plc • FCA-regulated</Text>
      </ScrollView>

      {/* -------- Bottom chat bar (persistent) -------- */}
      <View style={s.chatBar}>
        <TouchableOpacity
          style={s.chatIconBtn}
          onPress={() => router.push('/chat')}
          testID="home-chat-start"
        >
          <Ionicons name="chatbubbles-outline" size={22} color={C.ink} />
        </TouchableOpacity>
        <TouchableOpacity
          style={s.chatInputWrap}
          onPress={() => router.push('/chat')}
          activeOpacity={0.7}
        >
          <Text style={s.chatInputPlaceholder}>Start chat</Text>
          <Ionicons name="mic-outline" size={20} color={C.mutedInk} />
        </TouchableOpacity>
        <TouchableOpacity
          style={s.chatArrowBtn}
          onPress={() => router.push('/chat')}
          testID="home-chat-send"
        >
          <Ionicons name="arrow-forward" size={22} color={C.ink} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// -----------------------------------------------------------------------------
// Hero content shared between the image-backed and gradient-backed heroes.
// Renders the top nav pills and 4 circular action buttons.
// -----------------------------------------------------------------------------
function HeroContent({
  cc,
  unreadCount,
  router,
}: {
  cc: { primary: string };
  unreadCount: number;
  router: ReturnType<typeof useRouter>;
}) {
  return (
    <>
      {/* Top nav: home icon | Pay | Cards | Invest | hamburger */}
      <View style={s.heroNav}>
        <View style={s.heroHomeWrap}>
          <Ionicons name="home" size={22} color={C.ink} />
          <View style={[s.heroHomeUnderline, { backgroundColor: cc.primary }]} />
        </View>
        <View style={s.heroDivider} />
        <TouchableOpacity onPress={() => router.push('/(tabs)/transfers')}>
          <Text style={s.heroNavItem}>Pay</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/(tabs)/cards')} style={{ marginLeft: 22 }}>
          <Text style={s.heroNavItem}>Cards</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/analytics')} style={{ marginLeft: 22 }}>
          <Text style={s.heroNavItem}>Invest</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/profile')}
          testID="home-menu"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="menu" size={26} color={C.ink} />
          {unreadCount > 0 && (
            <View style={[s.menuBadge, { backgroundColor: cc.primary }]}>
              <Text style={s.menuBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* 4 circular action buttons across the bottom of the hero */}
      <View style={s.heroActions}>
        <HeroCircle
          icon={
            <View>
              <Ionicons name="person" size={20} color={cc.primary} />
              <View style={[s.circleUp, { backgroundColor: cc.primary }]}>
                <Ionicons name="arrow-up" size={10} color="#FFFFFF" />
              </View>
            </View>
          }
          label={'Pay someone\nin the UK'}
          onPress={() => router.push({ pathname: '/(tabs)/transfers' })}
          testID="hero-pay-uk"
        />
        <HeroCircle
          icon={<Ionicons name="swap-horizontal" size={22} color={cc.primary} />}
          label={'Transfer\nbetween your\naccounts'}
          onPress={() => router.push('/(tabs)/transfers')}
          testID="hero-transfer-own"
        />
        <HeroCircle
          icon={
            <View style={[s.poundIcon, { backgroundColor: cc.primary }]}>
              <Text style={s.poundIconTxt}>£</Text>
            </View>
          }
          label={'Pay a bill or\ncompany'}
          onPress={() => router.push('/pay-bill')}
          testID="hero-pay-bill"
        />
        <HeroCircle
          icon={<Ionicons name="add" size={24} color={C.ink} />}
          label={'Edit'}
          onPress={() => router.push('/customization')}
          testID="hero-edit"
        />
      </View>
    </>
  );
}

function HeroCircle({
  icon,
  label,
  onPress,
  testID,
}: {
  icon: React.ReactNode;
  label: string;
  onPress?: () => void;
  testID?: string;
}) {
  return (
    <TouchableOpacity style={s.heroCircleWrap} onPress={onPress} testID={testID} activeOpacity={0.85}>
      <View style={s.heroCircle}>{icon}</View>
      <Text style={s.heroCircleLabel} numberOfLines={3}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  loading: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },

  // -------- Hero band (top image / gradient) --------
  hero: {
    minHeight: 380,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 22,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  heroFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 220 },
  heroNav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  heroHomeWrap: { alignItems: 'center', paddingRight: 4 },
  heroHomeUnderline: { height: 3, width: 24, marginTop: 4, borderRadius: 2 },
  heroDivider: { width: 1, height: 22, backgroundColor: 'rgba(0,0,0,0.35)', marginHorizontal: 12 },
  heroNavItem: { fontSize: 18, fontWeight: '500', color: C.ink },
  menuBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  menuBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },

  heroActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
    marginTop: 200,
  },
  heroCircleWrap: {
    flex: 1,
    alignItems: 'center',
  },
  heroCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  heroCircleLabel: {
    marginTop: 8,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 15,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  circleUp: {
    position: 'absolute',
    bottom: -4,
    right: -6,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  poundIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  poundIconTxt: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },

  // -------- Your products section --------
  productsHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 14,
  },
  productsTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: C.ink,
    letterSpacing: -0.3,
  },
  eyeToggle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1B1B1B',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // -------- Product cards --------
  productCard: {
    backgroundColor: C.white,
    borderRadius: 8,
    padding: 18,
    marginBottom: 14,
  },
  productTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  productActions: { flexDirection: 'row', alignItems: 'center' },
  hsbcHex: {
    width: 28,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hsbcHexInner: {
    width: 18,
    height: 12,
    backgroundColor: '#FFFFFF',
    transform: [{ rotate: '45deg' }],
  },
  hsbcHexSmall: {
    width: 28,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
  },
  hsbcHexInnerSmall: {
    width: 14,
    height: 10,
    backgroundColor: '#FFFFFF',
  },
  productBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 8,
  },
  productName: { fontSize: 18, fontWeight: '700', color: C.ink, marginTop: 8 },
  productMeta: { fontSize: 13, color: C.mutedInk, marginTop: 4, letterSpacing: 0.3 },
  productAmountBlock: { alignItems: 'flex-end' },
  productAmountWhole: { fontSize: 26, fontWeight: '800', color: C.ink, letterSpacing: -0.5 },
  productAmountFrac: { fontSize: 15, fontWeight: '600' },

  // -------- Bottom chat bar --------
  chatBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#E9EBEE',
  },
  chatIconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatInputWrap: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#DADFE5',
    borderRadius: 4,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 4,
    backgroundColor: '#FFFFFF',
  },
  chatInputPlaceholder: { color: C.mutedInk, fontSize: 14 },
  chatArrowBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  footer: {
    textAlign: 'center',
    fontSize: 11,
    color: C.mutedInk,
    marginTop: 24,
  },

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
});
