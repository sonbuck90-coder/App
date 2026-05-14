/**
 * Modern Cards screen — dark hero + glossy card visuals + chunky action pills.
 * Used by Monzo, Starling, Revolut.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { cardsApi, Card } from '../services/api';
import { useCustomization } from '../context/CustomizationContext';
import { useAuth } from '../context/AuthContext';

const { width } = Dimensions.get('window');
const CARD_W = Math.min(width - 44, 360);

const fmt = (v: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(v);

export default function CardsModern() {
  const { colors: cc } = useCustomization();
  const { user } = useAuth();
  const router = useRouter();
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);

  useEffect(() => { load(); }, []);
  const load = async () => {
    try { const r = await cardsApi.getAll(); setCards(r.data); }
    catch { /* ignore */ }
    finally { setLoading(false); }
  };
  const toggleFreeze = async (c: Card) => {
    setBusy(c.id);
    try {
      if (c.is_frozen) { await cardsApi.unfreeze(c.id); Alert.alert('Activated', 'Card is active'); }
      else { await cardsApi.freeze(c.id); Alert.alert('Frozen', 'Card temporarily frozen'); }
      load();
    } catch (e: any) { Alert.alert('Error', e?.response?.data?.detail || 'Failed'); }
    finally { setBusy(null); }
  };

  if (loading) {
    return <View style={[s.center, { backgroundColor: cc.primary }]}><ActivityIndicator color="#fff" size="large" /></View>;
  }
  const active = cards[idx];

  return (
    <View style={[s.root, { backgroundColor: cc.primary }]}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {/* Title */}
          <View style={s.heroHeader}>
            <Text style={s.heroTitle}>Cards</Text>
            <Text style={s.heroSub}>{cards.length} active · tap to switch</Text>
          </View>

          {/* Card carousel */}
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 22 }}
            onMomentumScrollEnd={(e) => setIdx(Math.round(e.nativeEvent.contentOffset.x / (CARD_W + 12)))}
          >
            {cards.map((c) => (
              <View
                key={c.id}
                style={[
                  s.card,
                  { width: CARD_W, backgroundColor: c.card_type === 'credit' ? cc.accent : '#0B1424' },
                ]}
              >
                <View style={s.cardTop}>
                  <Text style={s.cardBrand}>{user?.name?.toUpperCase() || 'CARDHOLDER'}</Text>
                  <Ionicons name={c.card_type === 'credit' ? 'card' : 'card-outline'} size={28} color="#fff" />
                </View>
                <Text style={s.cardNo}>{c.card_number_masked}</Text>
                <View style={s.cardBottom}>
                  <View>
                    <Text style={s.cardLbl}>EXPIRES</Text>
                    <Text style={s.cardVal}>{c.expiry_date}</Text>
                  </View>
                  <View>
                    <Text style={s.cardLbl}>CARD</Text>
                    <Text style={s.cardVal}>{c.card_type.toUpperCase()}</Text>
                  </View>
                  {c.is_frozen && (
                    <View style={s.frozenChip}>
                      <Ionicons name="snow" size={12} color="#fff" />
                      <Text style={s.frozenChipText}>FROZEN</Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </ScrollView>

          {/* Dots */}
          <View style={s.dots}>
            {cards.map((_, i) => (
              <View key={i} style={[s.dot, i === idx && { backgroundColor: cc.accent, width: 22 }]} />
            ))}
          </View>

          {/* Bottom sheet */}
          <View style={s.sheet}>
            {active && (
              <>
                <Text style={s.sheetTitle}>{active.card_name}</Text>
                {active.card_type === 'credit' && active.credit_limit && (
                  <Text style={s.sheetSub}>Available {fmt(active.available_credit || 0)} of {fmt(active.credit_limit)}</Text>
                )}
                <View style={s.actionGrid}>
                  {[
                    {
                      icon: active.is_frozen ? 'flame' : 'snow',
                      label: active.is_frozen ? 'Unfreeze' : 'Freeze',
                      onPress: () => toggleFreeze(active),
                    },
                    { icon: 'create-outline', label: 'Edit', onPress: () => router.push({ pathname: '/card-details', params: { id: active.id } } as any) },
                    { icon: 'eye-outline', label: 'Reveal', onPress: () => Alert.alert(active.card_name, `Card number\n${active.card_number}\n\nCVV: ${active.cvv}`) },
                    { icon: 'list-outline', label: 'History', onPress: () => router.push('/transactions' as any) },
                  ].map((a) => (
                    <TouchableOpacity key={a.label} style={s.tile} onPress={a.onPress} disabled={busy === active.id && a.label.includes('reeze')}>
                      <View style={[s.tileIcon, { backgroundColor: `${cc.accent}22` }]}>
                        {busy === active.id && a.label.includes('reeze') ? (
                          <ActivityIndicator size="small" color={cc.accent} />
                        ) : (
                          <Ionicons name={a.icon as any} size={22} color={cc.accent} />
                        )}
                      </View>
                      <Text style={s.tileLabel}>{a.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={s.divider} />

                <Text style={s.sectionTitle}>Card details</Text>
                <View style={s.detailRow}><Text style={s.detailKey}>Card name</Text><Text style={s.detailVal}>{active.card_name}</Text></View>
                <View style={s.detailRow}><Text style={s.detailKey}>Card number</Text><Text style={s.detailVal}>{active.card_number_masked}</Text></View>
                <View style={s.detailRow}><Text style={s.detailKey}>Expiry</Text><Text style={s.detailVal}>{active.expiry_date}</Text></View>
                <View style={s.detailRow}><Text style={s.detailKey}>Status</Text><Text style={[s.detailVal, { color: active.is_frozen ? '#DC2626' : '#00847F' }]}>{active.is_frozen ? 'Frozen' : 'Active'}</Text></View>
              </>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  heroHeader: { paddingHorizontal: 22, paddingTop: 4, paddingBottom: 18 },
  heroTitle: { color: '#FFFFFF', fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  heroSub: { color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 4, fontWeight: '500' },
  card: { height: 200, borderRadius: 18, padding: 22, marginRight: 12, justifyContent: 'space-between' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardBrand: { color: '#FFFFFF', fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  cardNo: { color: '#FFFFFF', fontSize: 19, fontWeight: '700', letterSpacing: 2.5, marginTop: -4 },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardLbl: { color: 'rgba(255,255,255,0.6)', fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  cardVal: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', marginTop: 2, letterSpacing: 0.5 },
  frozenChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  frozenChipText: { color: '#fff', fontSize: 10, fontWeight: '700', marginLeft: 4, letterSpacing: 0.7 },
  dots: { flexDirection: 'row', justifyContent: 'center', marginTop: 16, marginBottom: 24 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.35)', marginHorizontal: 3 },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, minHeight: 360 },
  sheetTitle: { fontSize: 20, fontWeight: '700', color: '#0B1424' },
  sheetSub: { fontSize: 13, color: '#5E6A7A', marginTop: 4 },
  actionGrid: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 22 },
  tile: { alignItems: 'center', flex: 1 },
  tileIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  tileLabel: { fontSize: 12, fontWeight: '600', color: '#0B1424' },
  divider: { height: 1, backgroundColor: '#EFF1F4', marginVertical: 22 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#0B1424', marginBottom: 10 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F0F2F5' },
  detailKey: { fontSize: 13, color: '#5E6A7A' },
  detailVal: { fontSize: 13, fontWeight: '700', color: '#0B1424' },
});
