/**
 * Minimal Cards screen — Barclays-style: airy white, large list rows.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { cardsApi, Card } from '../services/api';
import { useCustomization } from '../context/CustomizationContext';

const fmt = (v: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(v);

export default function CardsMinimal() {
  const { colors: cc, headerTextColor } = useCustomization();
  const router = useRouter();
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

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

  if (loading) return <View style={s.center}><ActivityIndicator color={cc.primary} size="large" /></View>;

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={[s.headerStrip, { backgroundColor: cc.header }]}>
          <Text style={[s.title, { color: headerTextColor }]}>Cards</Text>
          <Text style={[s.sub, { color: headerTextColor, opacity: 0.7 }]}>{cards.length} cards · tap any card to manage</Text>
        </View>

        <View style={s.list}>
          {cards.map((c, i) => {
            const open = openId === c.id;
            return (
              <View key={c.id} style={[s.cardRow, i < cards.length - 1 && { borderBottomWidth: 1, borderBottomColor: '#EFF1F4' }]}>
                <TouchableOpacity style={s.cardHeaderTouch} onPress={() => setOpenId(open ? null : c.id)}>
                  <View style={[s.cardThumb, { backgroundColor: c.card_type === 'credit' ? cc.accent : cc.primary }]}>
                    <Ionicons name="card" size={20} color="#fff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.cardName}>{c.card_name}</Text>
                    <Text style={s.cardMeta}>{c.card_number_masked} · {c.is_frozen ? 'Frozen' : 'Active'}</Text>
                  </View>
                  {c.card_type === 'credit' && c.available_credit !== undefined && (
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={s.cardAvail}>{fmt(c.available_credit)}</Text>
                      <Text style={s.cardAvailSub}>available</Text>
                    </View>
                  )}
                  <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color="#C5CBD3" style={{ marginLeft: 8 }} />
                </TouchableOpacity>

                {open && (
                  <View style={s.expanded}>
                    <View style={s.detailGrid}>
                      <View style={s.detailCol}><Text style={s.detailKey}>Expiry</Text><Text style={s.detailVal}>{c.expiry_date}</Text></View>
                      <View style={s.detailCol}><Text style={s.detailKey}>Type</Text><Text style={s.detailVal}>{c.card_type.toUpperCase()}</Text></View>
                      <View style={s.detailCol}><Text style={s.detailKey}>Status</Text><Text style={[s.detailVal, { color: c.is_frozen ? '#DC2626' : '#00847F' }]}>{c.is_frozen ? 'Frozen' : 'Active'}</Text></View>
                    </View>

                    <View style={s.actionRow}>
                      <TouchableOpacity style={[s.actionBtn, { backgroundColor: cc.primary }]} onPress={() => toggleFreeze(c)} disabled={busy === c.id}>
                        {busy === c.id ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <>
                            <Ionicons name={c.is_frozen ? 'flame-outline' : 'snow-outline'} size={16} color="#fff" />
                            <Text style={s.actionText}>{c.is_frozen ? 'Unfreeze' : 'Freeze'}</Text>
                          </>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity style={s.actionOutline} onPress={() => router.push({ pathname: '/card-details', params: { id: c.id } } as any)}>
                        <Ionicons name="create-outline" size={16} color={cc.primary} />
                        <Text style={[s.actionOutlineText, { color: cc.primary }]}>Edit details</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={s.actionOutline} onPress={() => Alert.alert(c.card_name, `Card number\n${c.card_number}\n\nCVV: ${c.cvv}`)}>
                        <Ionicons name="eye-outline" size={16} color={cc.primary} />
                        <Text style={[s.actionOutlineText, { color: cc.primary }]}>Reveal</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
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
  headerStrip: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 24 },
  title: { fontSize: 28, fontWeight: '300', letterSpacing: -0.5 },
  sub: { fontSize: 12, marginTop: 6 },
  list: { marginHorizontal: 16, marginTop: 16, backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#EFF1F4', overflow: 'hidden' },
  cardRow: { backgroundColor: '#FFFFFF' },
  cardHeaderTouch: { flexDirection: 'row', alignItems: 'center', padding: 18 },
  cardThumb: { width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  cardName: { fontSize: 15, fontWeight: '700', color: '#0B1424' },
  cardMeta: { fontSize: 12, color: '#8893A3', marginTop: 3 },
  cardAvail: { fontSize: 14, fontWeight: '700', color: '#0B1424' },
  cardAvailSub: { fontSize: 11, color: '#8893A3', marginTop: 2 },
  expanded: { paddingHorizontal: 18, paddingBottom: 18, backgroundColor: '#F7F9FB' },
  detailGrid: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14 },
  detailCol: { flex: 1 },
  detailKey: { fontSize: 11, color: '#8893A3', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
  detailVal: { fontSize: 14, fontWeight: '700', color: '#0B1424' },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  actionText: { color: '#fff', fontSize: 13, fontWeight: '700', marginLeft: 6 },
  actionOutline: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#E5E8EC' },
  actionOutlineText: { fontSize: 13, fontWeight: '700', marginLeft: 6 },
});
