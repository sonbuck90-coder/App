import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { analyticsApi, SpendingAnalytics } from '../src/services/api';

const { width } = Dimensions.get('window');
const COLORS = { primary: '#DB0011', white: '#FFFFFF', lightGray: '#F5F5F5', gray: '#767676', darkGray: '#333333', black: '#000000', success: '#00847F', background: '#F5F5F5' };

const CATEGORY_COLORS = ['#DB0011', '#00847F', '#5856D6', '#FF9500', '#007AFF', '#34C759', '#AF52DE', '#FF2D55'];

export default function AnalyticsScreen() {
  const [data, setData] = useState<SpendingAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const res = await analyticsApi.getSpending();
      setData(res.data);
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  };

  const fmt = (v: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(v);

  if (isLoading) return <SafeAreaView style={styles.loading}><ActivityIndicator size="large" color={COLORS.primary} /></SafeAreaView>;

  const maxCat = data?.categories?.length ? Math.max(...data.categories.map(c => c.total)) : 1;
  const maxTrend = data?.monthly_trend?.length ? Math.max(...data.monthly_trend.map(m => m.total), 1) : 1;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Spending Insights</Text>
      </View>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Summary Card */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>This Month's Spending</Text>
          <Text style={styles.summaryAmount}>{fmt(data?.total_spending || 0)}</Text>
          <Text style={styles.summaryCount}>{data?.transaction_count || 0} transactions</Text>
        </View>

        {/* Category Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>By Category</Text>
          <View style={styles.card}>
            {data?.categories?.length ? data.categories.map((cat, i) => (
              <View key={cat.name} style={styles.categoryRow}>
                <View style={styles.categoryLeft}>
                  <View style={[styles.categoryDot, { backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }]} />
                  <View style={styles.categoryInfo}>
                    <Text style={styles.categoryName}>{cat.name}</Text>
                    <Text style={styles.categoryCount}>{cat.count} transaction{cat.count !== 1 ? 's' : ''}</Text>
                  </View>
                </View>
                <View style={styles.categoryRight}>
                  <Text style={styles.categoryAmount}>{fmt(cat.total)}</Text>
                  <View style={styles.barContainer}>
                    <View style={[styles.bar, { width: `${(cat.total / maxCat) * 100}%`, backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }]} />
                  </View>
                </View>
              </View>
            )) : (
              <View style={styles.emptyState}>
                <Ionicons name="analytics-outline" size={40} color={COLORS.gray} />
                <Text style={styles.emptyText}>No spending data yet</Text>
              </View>
            )}
          </View>
        </View>

        {/* Monthly Trend */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Monthly Trend</Text>
          <View style={styles.card}>
            <View style={styles.trendContainer}>
              {data?.monthly_trend?.map((month, i) => (
                <View key={`${month.month}-${month.year}`} style={styles.trendBar}>
                  <Text style={styles.trendAmount}>{month.total > 0 ? fmt(month.total) : '-'}</Text>
                  <View style={styles.trendBarOuter}>
                    <View style={[styles.trendBarInner, { height: `${Math.max((month.total / maxTrend) * 100, 4)}%`, backgroundColor: i === (data?.monthly_trend?.length || 0) - 1 ? COLORS.primary : '#E0E0E0' }]} />
                  </View>
                  <Text style={styles.trendMonth}>{month.month}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Top Payees */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top Payees</Text>
          <View style={styles.card}>
            {data?.top_payees?.length ? data.top_payees.map((payee, i) => (
              <View key={payee.name} style={[styles.topPayeeRow, i < (data?.top_payees?.length || 0) - 1 && styles.borderBottom]}>
                <View style={styles.topPayeeLeft}>
                  <View style={styles.rankBadge}><Text style={styles.rankText}>{i + 1}</Text></View>
                  <Text style={styles.topPayeeName}>{payee.name}</Text>
                </View>
                <Text style={styles.topPayeeAmount}>{fmt(payee.total)}</Text>
              </View>
            )) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No payee data yet</Text>
              </View>
            )}
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loading: { flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' },
  header: { backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 16 },
  headerTitle: { fontSize: 20, fontWeight: '600', color: COLORS.white },
  scrollView: { flex: 1 },
  summaryCard: { backgroundColor: COLORS.white, margin: 16, padding: 24, borderRadius: 8, borderLeftWidth: 4, borderLeftColor: COLORS.primary, alignItems: 'center' },
  summaryLabel: { fontSize: 14, color: COLORS.gray },
  summaryAmount: { fontSize: 36, fontWeight: '700', color: COLORS.darkGray, marginVertical: 8 },
  summaryCount: { fontSize: 14, color: COLORS.gray },
  section: { marginHorizontal: 16, marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: COLORS.darkGray, marginBottom: 12 },
  card: { backgroundColor: COLORS.white, borderRadius: 8, padding: 16 },
  categoryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  categoryLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  categoryDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  categoryInfo: { flex: 1 },
  categoryName: { fontSize: 14, fontWeight: '600', color: COLORS.darkGray },
  categoryCount: { fontSize: 12, color: COLORS.gray },
  categoryRight: { alignItems: 'flex-end', width: 140 },
  categoryAmount: { fontSize: 15, fontWeight: '600', color: COLORS.darkGray, marginBottom: 6 },
  barContainer: { width: '100%', height: 6, backgroundColor: '#F0F0F0', borderRadius: 3, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 3 },
  trendContainer: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 180 },
  trendBar: { alignItems: 'center', flex: 1 },
  trendAmount: { fontSize: 10, color: COLORS.gray, marginBottom: 4 },
  trendBarOuter: { width: 28, height: 120, backgroundColor: '#F0F0F0', borderRadius: 4, overflow: 'hidden', justifyContent: 'flex-end' },
  trendBarInner: { width: '100%', borderRadius: 4 },
  trendMonth: { fontSize: 12, color: COLORS.gray, marginTop: 8, fontWeight: '500' },
  topPayeeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  borderBottom: { borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  topPayeeLeft: { flexDirection: 'row', alignItems: 'center' },
  rankBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.lightGray, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  rankText: { fontSize: 13, fontWeight: '700', color: COLORS.darkGray },
  topPayeeName: { fontSize: 15, fontWeight: '500', color: COLORS.darkGray },
  topPayeeAmount: { fontSize: 15, fontWeight: '600', color: COLORS.primary },
  emptyState: { alignItems: 'center', paddingVertical: 24 },
  emptyText: { fontSize: 14, color: COLORS.gray, marginTop: 8 },
});
