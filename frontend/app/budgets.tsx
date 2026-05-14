import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { api } from '../src/services/api';
import { useCustomization } from '../src/context/CustomizationContext';
import BackButton from '../src/components/BackButton';

interface BudgetItem {
  category: string;
  limit: number;
  spent: number;
  percent: number;
}

const CATEGORY_META: Record<string, { icon: string; description: string }> = {
  Bills: { icon: 'receipt-outline', description: 'Utilities, broadband, subscriptions' },
  Transfers: { icon: 'swap-horizontal-outline', description: 'Person-to-person payments' },
  Other: { icon: 'wallet-outline', description: 'Everything else' },
};

export default function BudgetsScreen() {
  const { colors: cc, headerTextColor } = useCustomization();
  const [items, setItems] = useState<BudgetItem[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/budgets');
      setItems(res.data.items);
      const map: Record<string, string> = {};
      res.data.items.forEach((it: BudgetItem) => {
        map[it.category] = it.limit > 0 ? String(it.limit) : '';
      });
      setEdits(map);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const save = async (cat: string) => {
    const raw = (edits[cat] || '0').replace(/[^\d.]/g, '');
    const limit = parseFloat(raw) || 0;
    if (limit < 0) {
      Alert.alert('Invalid amount', 'Budget must be a positive number.');
      return;
    }
    setSaving(cat);
    try {
      await api.put('/budgets', { category: cat, limit });
      await load();
    } catch (e: any) {
      Alert.alert('Could not save', e.message || 'Try again');
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <ActivityIndicator color={cc.primary} size="large" style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={[s.header, { backgroundColor: cc.header }]}>
        <BackButton color={headerTextColor} />
        <Text style={[s.headerTitle, { color: headerTextColor }]}>Monthly Budgets</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView style={s.scroll} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <View style={s.intro}>
            <View style={[s.introIcon, { backgroundColor: `${cc.primary}15` }]}>
              <Ionicons name="trending-up-outline" size={22} color={cc.primary} />
            </View>
            <Text style={s.introTitle}>Stay on top of your spending</Text>
            <Text style={s.introSub}>Set a monthly limit per category. We'll send you a notification when you hit 80% and 100%.</Text>
          </View>

          {items.map((it) => {
            const pct = it.percent;
            const meta = CATEGORY_META[it.category] || { icon: 'ellipse-outline', description: '' };
            const danger = pct >= 100;
            const warning = pct >= 80 && pct < 100;
            const barColor = danger ? '#DB0011' : warning ? '#E67E22' : '#00847F';
            return (
              <View key={it.category} style={s.card}>
                <View style={s.cardHeader}>
                  <View style={[s.catIcon, { backgroundColor: `${cc.primary}12` }]}>
                    <Ionicons name={meta.icon as any} size={20} color={cc.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.catName}>{it.category}</Text>
                    <Text style={s.catSub}>{meta.description}</Text>
                  </View>
                </View>

                <View style={s.amountsRow}>
                  <Text style={s.spent}>£{it.spent.toFixed(2)}<Text style={s.spentSub}>{it.limit > 0 ? ` / £${it.limit.toFixed(2)}` : ''}</Text></Text>
                  {it.limit > 0 && (
                    <Text style={[s.pct, { color: barColor }]}>{pct.toFixed(0)}%</Text>
                  )}
                </View>

                {it.limit > 0 ? (
                  <View style={s.barTrack}>
                    <View style={[s.barFill, { width: `${Math.min(100, pct)}%`, backgroundColor: barColor }]} />
                  </View>
                ) : (
                  <Text style={s.noLimit}>No limit set</Text>
                )}

                <View style={s.inputRow}>
                  <Text style={s.poundPrefix}>£</Text>
                  <TextInput
                    style={s.input}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor="#9AA3AF"
                    value={edits[it.category] || ''}
                    onChangeText={(t) => setEdits({ ...edits, [it.category]: t })}
                    testID={`budget-input-${it.category}`}
                  />
                  <TouchableOpacity
                    style={[s.saveBtn, { backgroundColor: cc.primary }]}
                    onPress={() => save(it.category)}
                    disabled={saving === it.category}
                  >
                    {saving === it.category ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={s.saveBtnText}>{it.limit > 0 ? 'Update' : 'Set'}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  header: { paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  scroll: { flex: 1 },
  intro: { padding: 20, alignItems: 'flex-start' },
  introIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  introTitle: { fontSize: 17, fontWeight: '700', color: '#0B1424', marginBottom: 4 },
  introSub: { fontSize: 13, color: '#5E6A7A', lineHeight: 18 },
  card: { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 14, borderRadius: 12, padding: 16 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  catIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  catName: { fontSize: 16, fontWeight: '700', color: '#0B1424' },
  catSub: { fontSize: 12, color: '#8893A3', marginTop: 2 },
  amountsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 },
  spent: { fontSize: 20, fontWeight: '700', color: '#0B1424' },
  spentSub: { fontSize: 13, fontWeight: '500', color: '#8893A3' },
  pct: { fontSize: 14, fontWeight: '700' },
  barTrack: { height: 8, backgroundColor: '#EFF1F4', borderRadius: 4, overflow: 'hidden', marginBottom: 14 },
  barFill: { height: '100%', borderRadius: 4 },
  noLimit: { fontSize: 12, color: '#8893A3', marginBottom: 14, fontStyle: 'italic' },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  poundPrefix: { fontSize: 16, fontWeight: '600', color: '#0B1424', marginRight: 6 },
  input: { flex: 1, height: 44, borderWidth: 1, borderColor: '#E5E8EC', borderRadius: 8, paddingHorizontal: 12, fontSize: 15, color: '#0B1424' },
  saveBtn: { height: 44, paddingHorizontal: 18, borderRadius: 8, marginLeft: 10, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
