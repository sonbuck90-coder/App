import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCustomization } from '../src/context/CustomizationContext';
import { downloadMonthlyStatement } from '../src/services/offline-docs';
import { getBankTheme } from '../src/context/BankThemes';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function StatementsScreen() {
  const router = useRouter();
  const { colors: cc, headerTextColor, bankThemeId } = useCustomization();
  const bankName = getBankTheme(bankThemeId).name;
  const today = new Date();
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);

  // Build a list of the last 12 months
  const months = [] as { year: number; month: number; label: string; key: string }[];
  for (let i = 0; i < 12; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth() + 1, label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`, key: `${d.getFullYear()}-${d.getMonth() + 1}` });
  }

  const download = async (y: number, m: number) => {
    const key = `${y}-${m}`;
    setDownloadingKey(key);
    try {
      await downloadMonthlyStatement(y, m);
    } catch (e: any) {
      Alert.alert('Download Failed', e.message || 'Could not download statement');
    } finally {
      setDownloadingKey(null);
    }
  };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={[s.header, { backgroundColor: cc.header }]}>
        <TouchableOpacity onPress={() => router.back()} testID="back-btn"><Ionicons name="arrow-back" size={24} color={headerTextColor} /></TouchableOpacity>
        <Text style={[s.headerTitle, { color: headerTextColor }]}>Monthly Statements</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.heroCard}>
          <Ionicons name="document-text" size={36} color={cc.primary} />
          <Text style={s.heroTitle}>Download your statements</Text>
          <Text style={s.heroSub}>{bankName} provides downloadable PDF statements for the past 12 months. Tap any month to download.</Text>
        </View>

        <Text style={s.sectionLabel}>LAST 12 MONTHS</Text>
        <View style={s.list}>
          {months.map((m, i) => (
            <TouchableOpacity
              key={m.key}
              style={[s.row, i < months.length - 1 && s.rowBorder]}
              onPress={() => download(m.year, m.month)}
              disabled={downloadingKey === m.key}
              testID={`statement-${m.key}`}
            >
              <View style={[s.monthIcon, { backgroundColor: `${cc.primary}15` }]}>
                <Text style={[s.monthIconText, { color: cc.primary }]}>{MONTHS[m.month - 1].slice(0, 3)}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={s.rowTitle}>{m.label}</Text>
                <Text style={s.rowSub}>PDF · monthly statement</Text>
              </View>
              {downloadingKey === m.key ? (
                <ActivityIndicator color={cc.primary} />
              ) : (
                <Ionicons name="download-outline" size={22} color={cc.primary} />
              )}
            </TouchableOpacity>
          ))}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  content: { padding: 16 },
  heroCard: { backgroundColor: '#FFF', borderRadius: 14, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: '#E5E8EC' },
  heroTitle: { fontSize: 18, fontWeight: '700', color: '#0B1424', marginTop: 12, textAlign: 'center' },
  heroSub: { fontSize: 13, color: '#5E6A7A', marginTop: 6, textAlign: 'center', lineHeight: 19 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#8893A3', letterSpacing: 1.1, marginTop: 22, marginBottom: 8, marginLeft: 4 },
  list: { backgroundColor: '#FFF', borderRadius: 14, borderWidth: 1, borderColor: '#E5E8EC', overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#EFF1F4' },
  monthIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  monthIconText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  rowTitle: { fontSize: 15, fontWeight: '700', color: '#0B1424' },
  rowSub: { fontSize: 12, color: '#8893A3', marginTop: 2 },
});
