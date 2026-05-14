import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { cardsApi, Card } from '../../src/services/api';
import { useCustomization } from '../../src/context/CustomizationContext';
import { useAuth } from '../../src/context/AuthContext';
import { getLayoutFor } from '../../src/context/BankThemes';
import CardsModern from '../../src/screens/CardsModern';
import CardsMinimal from '../../src/screens/CardsMinimal';

const { width } = Dimensions.get('window');

const C = { white: '#FFFFFF', lightGray: '#F2F2F2', gray: '#767676', darkGray: '#333333', black: '#000000', success: '#00847F', bg: '#FFFFFF', cardBg: '#E8E8E8' };

/**
 * Cards layout chooser — picks Classic / Modern / Minimal based on the
 * active bank theme. Each layout is an entirely different visual design.
 */
export default function Cards() {
  const { bankThemeId } = useCustomization();
  const layout = getLayoutFor(bankThemeId);
  if (layout === 'modern') return <CardsModern />;
  if (layout === 'minimal') return <CardsMinimal />;
  return <CardsClassic />;
}

function CardsClassic() {
  const { colors: cc } = useCustomization();
  const { user } = useAuth();
  const router = useRouter();
  const [cards, setCards] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingCardId, setProcessingCardId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('Cards');
  const [activeCardIndex, setActiveCardIndex] = useState(0);

  useEffect(() => { fetchCards(); }, []);

  const fetchCards = async () => {
    try { const r = await cardsApi.getAll(); setCards(r.data); }
    catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  };

  const toggleFreeze = async (card: Card) => {
    setProcessingCardId(card.id);
    try {
      if (card.is_frozen) {
        await cardsApi.unfreeze(card.id);
        Alert.alert('Card Activated', 'Your card is now active');
      } else {
        await cardsApi.freeze(card.id);
        Alert.alert('Card Frozen', 'Your card has been temporarily frozen');
      }
      fetchCards();
    } catch (e: any) { Alert.alert('Error', e.response?.data?.detail || 'Failed'); }
    finally { setProcessingCardId(null); }
  };

  const fmt = (v: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(v);

  if (isLoading) return <SafeAreaView style={styles.loading}><ActivityIndicator size="large" color={cc.primary} /></SafeAreaView>;

  const activeCard = cards[activeCardIndex];
  const topTabs = ['Home', 'Pay', 'Cards', 'Invest'];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top Navigation - matching HSBC */}
      <View style={styles.topNav}>
        <TouchableOpacity style={styles.topNavHomeBtn} testID="nav-home">
          <Ionicons name="home-outline" size={22} color={C.darkGray} />
        </TouchableOpacity>
        <View style={styles.topNavDivider} />
        {topTabs.slice(1).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={styles.topNavTab}
            onPress={() => setActiveTab(tab)}
            testID={`nav-tab-${tab}`}
          >
            <Text style={[styles.topNavTabText, activeTab === tab && [styles.topNavTabTextActive, { color: C.darkGray }]]}>{tab}</Text>
            {activeTab === tab && <View style={[styles.topNavTabIndicator, { backgroundColor: cc.primary }]} />}
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={styles.topNavMenuBtn} testID="nav-menu">
          <Ionicons name="menu" size={24} color={C.darkGray} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Account Header */}
        <View style={styles.accountHeader}>
          <Text style={styles.accountTitle}>BANK A/C</Text>
          <Text style={styles.accountName}>{user?.name || 'Mr O sky'}</Text>
        </View>

        {/* Card Display */}
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={(e) => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / (width - 80));
            setActiveCardIndex(idx);
          }}
          scrollEventThrottle={16}
          contentContainerStyle={styles.cardScroll}
        >
          {cards.map((card) => (
            <View key={card.id} style={styles.cardOuter}>
              <View style={[styles.bankCard, card.is_frozen && styles.bankCardFrozen]}>
                {card.is_frozen && (
                  <View style={styles.frozenBanner}>
                    <Ionicons name="snow" size={14} color={C.white} />
                    <Text style={styles.frozenBannerText}>FROZEN</Text>
                  </View>
                )}
                {/* Card Top Row - Logo + Name + Type Badge */}
                <View style={styles.cardTopRow}>
                  <View style={styles.cardLogoRow}>
                    {/* HSBC Hexagon Logo */}
                    <View style={styles.hsbcLogo}>
                      <View style={styles.hexRow}>
                        <View style={[styles.hex, { backgroundColor: cc.primary }]} />
                        <View style={[styles.hex, { backgroundColor: C.white, borderWidth: 1, borderColor: cc.primary }]} />
                      </View>
                      <View style={styles.hexRow}>
                        <View style={[styles.hex, { backgroundColor: C.white, borderWidth: 1, borderColor: cc.primary }]} />
                        <View style={[styles.hex, { backgroundColor: cc.primary }]} />
                      </View>
                    </View>
                    <Text style={styles.cardBankName}>HSBC UK</Text>
                  </View>
                  <View style={styles.cardTypeBadge}>
                    <Text style={styles.cardTypeBadgeText}>
                      {card.card_type === 'debit' ? 'Debit' : 'Credit'}
                    </Text>
                  </View>
                </View>

                {/* Card Number at Bottom */}
                <Text style={styles.cardMaskedNumber}>{card.card_number_masked}</Text>
              </View>
            </View>
          ))}
        </ScrollView>

        {/* Card Indicators */}
        {cards.length > 1 && (
          <View style={styles.indicators}>
            {cards.map((_, i) => (
              <View key={i} style={[styles.indicator, activeCardIndex === i && [styles.indicatorActive, { backgroundColor: cc.primary }]]} />
            ))}
          </View>
        )}

        {/* Card Details Link */}
        <TouchableOpacity
          style={styles.cardDetailsLink}
          onPress={() => activeCard && router.push({ pathname: '/card-details', params: { cardId: activeCard.id } })}
          testID="card-details-link"
        >
          <Text style={styles.cardDetailsText}>Card details</Text>
          <Ionicons name="arrow-forward" size={20} color={C.darkGray} />
        </TouchableOpacity>

        {/* Credit Info (if credit card selected) */}
        {activeCard && activeCard.card_type === 'credit' && activeCard.credit_limit && (
          <View style={styles.creditSection}>
            <View style={styles.creditRow}>
              <Text style={styles.creditLabel}>Credit Limit</Text>
              <Text style={styles.creditVal}>{fmt(activeCard.credit_limit)}</Text>
            </View>
            <View style={styles.creditRow}>
              <Text style={styles.creditLabel}>Available</Text>
              <Text style={[styles.creditVal, { color: C.success }]}>{fmt(activeCard.available_credit || 0)}</Text>
            </View>
            <View style={styles.creditBar}>
              <View style={[styles.creditFill, { width: `${((activeCard.credit_limit - (activeCard.available_credit || 0)) / activeCard.credit_limit) * 100}%`, backgroundColor: cc.primary }]} />
            </View>
          </View>
        )}

        {/* Divider */}
        <View style={styles.divider} />

        {/* Action Buttons - matching HSBC exactly */}
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionItem} testID="action-report">
            <View style={styles.actionCircle}>
              <Ionicons name="warning-outline" size={26} color={C.darkGray} />
            </View>
            <Text style={styles.actionLabel}>Report a{'\n'}card issue</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionItem} testID="action-pin">
            <View style={styles.actionCircle}>
              <Ionicons name="eye-outline" size={26} color={C.darkGray} />
            </View>
            <Text style={styles.actionLabel}>View card{'\n'}PIN</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => activeCard && toggleFreeze(activeCard)}
            disabled={processingCardId === activeCard?.id}
            testID="action-freeze"
          >
            <View style={[styles.actionCircle, activeCard?.is_frozen && { backgroundColor: `${cc.primary}20` }]}>
              {processingCardId === activeCard?.id ? (
                <ActivityIndicator size="small" color={cc.primary} />
              ) : (
                <Ionicons name="snow" size={26} color={activeCard?.is_frozen ? cc.primary : C.darkGray} />
              )}
            </View>
            <Text style={styles.actionLabel}>{activeCard?.is_frozen ? 'Unfreeze' : 'Freeze'}{'\n'}card</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionItem} testID="action-gambling">
            <View style={styles.actionCircle}>
              <Ionicons name="lock-closed-outline" size={26} color={C.darkGray} />
            </View>
            <Text style={styles.actionLabel}>Gambling{'\n'}restrictions</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  loading: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  // Top Nav
  topNav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  topNavHomeBtn: { padding: 4 },
  topNavDivider: { width: 1, height: 20, backgroundColor: '#D0D0D0', marginHorizontal: 12 },
  topNavTab: { paddingHorizontal: 14, paddingVertical: 8, alignItems: 'center', position: 'relative' },
  topNavTabText: { fontSize: 16, fontWeight: '400', color: C.gray },
  topNavTabTextActive: { fontWeight: '600' },
  topNavTabIndicator: { position: 'absolute', bottom: 0, left: 8, right: 8, height: 3, borderRadius: 1.5 },
  topNavMenuBtn: { marginLeft: 'auto', padding: 4 },
  // Account Header
  accountHeader: { alignItems: 'center', paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: '#E8E8E8' },
  accountTitle: { fontSize: 20, fontWeight: '700', color: C.darkGray, letterSpacing: 0.5 },
  accountName: { fontSize: 15, color: C.gray, marginTop: 4 },
  // Card
  cardScroll: { paddingHorizontal: 32, paddingTop: 24, paddingBottom: 8 },
  cardOuter: { width: width - 64, marginRight: 16 },
  bankCard: { backgroundColor: '#E0E0E0', borderRadius: 16, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 20, height: 200, justifyContent: 'space-between' },
  bankCardFrozen: { opacity: 0.6 },
  frozenBanner: { position: 'absolute', top: 10, right: 10, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, zIndex: 1 },
  frozenBannerText: { color: C.white, fontSize: 10, fontWeight: '700', marginLeft: 4 },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardLogoRow: { flexDirection: 'row', alignItems: 'center' },
  hsbcLogo: { marginRight: 10 },
  hexRow: { flexDirection: 'row' },
  hex: { width: 12, height: 12, margin: 0.5 },
  cardBankName: { fontSize: 17, fontWeight: '700', color: C.darkGray },
  cardTypeBadge: { backgroundColor: C.white, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 4 },
  cardTypeBadgeText: { fontSize: 13, fontWeight: '500', color: C.darkGray },
  cardMaskedNumber: { fontSize: 16, color: '#666666', letterSpacing: 2 },
  // Indicators
  indicators: { flexDirection: 'row', justifyContent: 'center', marginTop: 12 },
  indicator: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#D0D0D0', marginHorizontal: 4 },
  indicatorActive: { width: 20 },
  // Card Details Link
  cardDetailsLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 20 },
  cardDetailsText: { fontSize: 16, color: C.darkGray, marginRight: 8 },
  // Credit Section
  creditSection: { marginHorizontal: 32, marginBottom: 16, backgroundColor: C.lightGray, borderRadius: 8, padding: 16 },
  creditRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  creditLabel: { fontSize: 14, color: C.gray },
  creditVal: { fontSize: 14, fontWeight: '600', color: C.darkGray },
  creditBar: { height: 6, backgroundColor: '#D0D0D0', borderRadius: 3, overflow: 'hidden', marginTop: 8 },
  creditFill: { height: '100%', borderRadius: 3 },
  // Divider
  divider: { height: 1, backgroundColor: '#E0E0E0', marginHorizontal: 0 },
  // Actions
  actionsRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 24, paddingHorizontal: 16 },
  actionItem: { alignItems: 'center', width: 80 },
  actionCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: C.lightGray, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  actionLabel: { fontSize: 12, color: C.darkGray, textAlign: 'center', lineHeight: 16 },
});
