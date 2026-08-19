import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { transactionsApi, Transaction } from '../src/services/api';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import BackButton from '../src/components/BackButton';

const COLORS = { primary: '#DB0011', white: '#FFFFFF', lightGray: '#F5F5F5', gray: '#767676', darkGray: '#333333', black: '#000000', success: '#00847F', background: '#F5F5F5', warning: '#E67E22' };

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'sent', label: 'Sent' },
  { key: 'received', label: 'Received' },
];

export default function TransactionsScreen() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => { fetchTransactions(); }, [activeFilter]);

  const fetchTransactions = async () => {
    try {
      const filterParam = activeFilter === 'all' ? '' : `?filter_type=${activeFilter}`;
      const res = await transactionsApi.getAll(100, activeFilter === 'all' ? undefined : activeFilter);
      setTransactions(res.data);
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); setRefreshing(false); }
  };

  const onRefresh = useCallback(() => { setRefreshing(true); fetchTransactions(); }, [activeFilter]);

  const fmt = (v: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(v);

  const formatDate = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const getIcon = (type: string): keyof typeof Ionicons.glyphMap => {
    switch (type) {
      case 'transfer': return 'arrow-forward';
      case 'payment': return 'receipt';
      case 'deposit': return 'arrow-down';
      default: return 'cash';
    }
  };

  const getIconColor = (type: string) => {
    switch (type) {
      case 'transfer': return '#007AFF';
      case 'payment': return '#FF9500';
      case 'deposit': return COLORS.success;
      default: return COLORS.gray;
    }
  };

  const handleDownload = (format: 'csv' | 'pdf') => {
    Alert.alert(
      `Download ${format.toUpperCase()} Statement`,
      `Your ${format.toUpperCase()} statement will be generated and ready for download.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Download', onPress: () => downloadStatement(format) },
      ]
    );
  };

  const downloadStatement = async (format: 'csv' | 'pdf') => {
    setIsDownloading(true);
    try {
      const { downloadTransactionsExport } = await import('../src/services/offline-docs');
      await downloadTransactionsExport(format);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to download statement. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  // Group transactions by date
  const grouped = transactions.reduce((acc, txn) => {
    const date = formatDate(txn.timestamp);
    if (!acc[date]) acc[date] = [];
    acc[date].push(txn);
    return acc;
  }, {} as { [key: string]: Transaction[] });

  if (isLoading) return <SafeAreaView style={styles.loading}><ActivityIndicator size="large" color={COLORS.primary} /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <BackButton color={COLORS.white} />
        <Text style={styles.headerTitle}>Transaction History</Text>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterTab, activeFilter === f.key && styles.filterTabActive]}
            onPress={() => { setActiveFilter(f.key); setIsLoading(true); }}
            testID={`filter-${f.key}`}
          >
            <Text style={[styles.filterText, activeFilter === f.key && styles.filterTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Download Actions */}
      <View style={styles.downloadContainer}>
        <TouchableOpacity style={styles.downloadBtn} onPress={() => handleDownload('csv')} disabled={isDownloading} testID="download-csv-btn">
          <Ionicons name="document-text-outline" size={18} color={COLORS.primary} />
          <Text style={styles.downloadBtnText}>CSV</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.downloadBtn} onPress={() => handleDownload('pdf')} disabled={isDownloading} testID="download-pdf-btn">
          <Ionicons name="download-outline" size={18} color={COLORS.primary} />
          <Text style={styles.downloadBtnText}>PDF</Text>
        </TouchableOpacity>
        {isDownloading && <ActivityIndicator size="small" color={COLORS.primary} style={{ marginLeft: 12 }} />}
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {transactions.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={56} color={COLORS.gray} />
            <Text style={styles.emptyTitle}>No Transactions</Text>
            <Text style={styles.emptySubtext}>
              {activeFilter === 'sent' ? 'No sent transactions yet' :
               activeFilter === 'received' ? 'No received transactions yet' :
               'Your transaction history will appear here'}
            </Text>
          </View>
        ) : (
          Object.entries(grouped).map(([date, txns]) => (
            <View key={date} style={styles.dateGroup}>
              <Text style={styles.dateHeader}>{date}</Text>
              <View style={styles.transactionsCard}>
                {txns.map((txn, i) => (
                  <TouchableOpacity
                    key={txn.id}
                    style={[styles.txnRow, i < txns.length - 1 && styles.txnBorder]}
                    onPress={() => router.push({ pathname: '/transaction-detail', params: { id: txn.id } })}
                    onLongPress={() => {
                      Alert.alert(
                        'Delete transaction?',
                        `Are you sure you want to delete the £${txn.amount.toFixed(2)} ${txn.transaction_type} to ${txn.recipient_name || txn.description}? This cannot be undone.`,
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Delete',
                            style: 'destructive',
                            onPress: async () => {
                              try {
                                await transactionsApi.delete(txn.id);
                                setTransactions((prev) => prev.filter((t) => t.id !== txn.id));
                              } catch (e: any) {
                                Alert.alert('Error', e.response?.data?.detail || 'Could not delete');
                              }
                            },
                          },
                        ]
                      );
                    }}
                    delayLongPress={400}
                    testID={`txn-row-${txn.id}`}
                    activeOpacity={0.6}
                  >
                    <View style={[styles.txnIcon, { backgroundColor: `${getIconColor(txn.transaction_type)}15` }]}>
                      <Ionicons name={getIcon(txn.transaction_type)} size={20} color={getIconColor(txn.transaction_type)} />
                    </View>
                    <View style={styles.txnInfo}>
                      <Text style={styles.txnTitle}>{txn.recipient_name || txn.description}</Text>
                      <Text style={styles.txnDesc}>{txn.description}</Text>
                      <Text style={styles.txnTime}>{formatTime(txn.timestamp)}</Text>
                    </View>
                    <View style={styles.txnRight}>
                      <Text style={[styles.txnAmount, txn.transaction_type === 'deposit' ? styles.amountPositive : styles.amountNegative]}>
                        {txn.transaction_type === 'deposit' ? '+' : '-'}{fmt(txn.amount)}
                      </Text>
                      <View style={[styles.statusBadge, { backgroundColor: txn.status === 'completed' ? `${COLORS.success}20` : '#FFF3E0' }]}>
                        <Text style={[styles.statusText, { color: txn.status === 'completed' ? COLORS.success : COLORS.warning }]}>
                          {txn.status}
                        </Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={COLORS.gray} style={{ marginLeft: 6 }} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loading: { flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' },
  header: { backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 16, flexDirection: 'row', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '600', color: COLORS.white },
  filterContainer: { flexDirection: 'row', backgroundColor: COLORS.white, margin: 16, borderRadius: 8, padding: 4 },
  filterTab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 6 },
  filterTabActive: { backgroundColor: COLORS.primary },
  filterText: { fontSize: 14, fontWeight: '600', color: COLORS.gray },
  filterTextActive: { color: COLORS.white },
  downloadContainer: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 8, alignItems: 'center' },
  downloadBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 10, borderWidth: 1, borderColor: '#E0E0E0' },
  downloadBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.primary, marginLeft: 6 },
  scrollView: { flex: 1 },
  emptyState: { alignItems: 'center', paddingVertical: 64 },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: COLORS.darkGray, marginTop: 16 },
  emptySubtext: { fontSize: 14, color: COLORS.gray, marginTop: 8 },
  dateGroup: { marginHorizontal: 16, marginBottom: 16 },
  dateHeader: { fontSize: 14, fontWeight: '600', color: COLORS.gray, marginBottom: 8 },
  transactionsCard: { backgroundColor: COLORS.white, borderRadius: 8 },
  txnRow: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  txnBorder: { borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  txnIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  txnInfo: { flex: 1 },
  txnTitle: { fontSize: 15, fontWeight: '600', color: COLORS.darkGray },
  txnDesc: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  txnTime: { fontSize: 11, color: COLORS.gray, marginTop: 2 },
  txnRight: { alignItems: 'flex-end' },
  txnAmount: { fontSize: 16, fontWeight: '700' },
  amountPositive: { color: COLORS.success },
  amountNegative: { color: COLORS.darkGray },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginTop: 4 },
  statusText: { fontSize: 10, fontWeight: '600', textTransform: 'capitalize' },
});
