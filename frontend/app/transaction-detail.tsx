import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Platform, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { transactionsApi, accountsApi, api, Transaction, Account } from '../src/services/api';
import { useCustomization } from '../src/context/CustomizationContext';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const C = {
  white: '#FFFFFF',
  lightGray: '#F5F5F5',
  gray: '#767676',
  darkGray: '#333333',
  black: '#000000',
  success: '#00847F',
  warning: '#E67E22',
  bg: '#F5F5F5',
  border: '#E8E8E8',
};

export default function TransactionDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors: cc } = useCustomization();
  const [txn, setTxn] = useState<Transaction | null>(null);
  const [fromAccount, setFromAccount] = useState<Account | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    if (id) load(id);
  }, [id]);

  const load = async (txnId: string) => {
    try {
      const res = await transactionsApi.getById(txnId);
      setTxn(res.data);
      if (res.data.from_account_id) {
        try {
          const acc = await accountsApi.getById(res.data.from_account_id);
          setFromAccount(acc.data);
        } catch (e) {
          // ignore
        }
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to load transaction');
    } finally {
      setIsLoading(false);
    }
  };

  const fmt = (v: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(v);

  const formatDateTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'short' });
  };

  const handleDownload = async () => {
    if (!txn) return;
    setIsDownloading(true);
    try {
      const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
      const token = api.defaults.headers.common['Authorization'];
      const url = `${BACKEND_URL}/api/receipts/${txn.id}`;

      if (Platform.OS === 'web') {
        const tokenStr = typeof token === 'string' ? token.replace('Bearer ', '') : '';
        window.open(`${url}?token=${tokenStr}`, '_blank');
      } else {
        const fileUri = `${FileSystem.documentDirectory}HSBC_Receipt_${txn.id.slice(0, 8)}.pdf`;
        const tokenStr = typeof token === 'string' ? token : '';
        const dl = await FileSystem.downloadAsync(url, fileUri, { headers: { Authorization: tokenStr } });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(dl.uri);
        } else {
          Alert.alert('Success', `Saved to ${dl.uri}`);
        }
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to download receipt.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShare = async () => {
    if (!txn) return;
    const lines = [
      'HSBC Transaction Invoice',
      `Reference: ${txn.id.slice(0, 12).toUpperCase()}`,
      `Date: ${formatDateTime(txn.timestamp)}`,
      `Type: ${txn.transaction_type}`,
      `Amount: ${txn.transaction_type === 'deposit' ? '+' : '-'}${fmt(txn.amount)}`,
      `Recipient: ${txn.recipient_name || 'N/A'}`,
      txn.recipient_sort_code ? `Sort Code: ${txn.recipient_sort_code}` : '',
      txn.recipient_account_number ? `Account: ${txn.recipient_account_number}` : '',
      `Status: ${txn.status}`,
    ].filter(Boolean).join('\n');
    try {
      await Share.share({ message: lines, title: 'Transaction Invoice' });
    } catch (e) {
      // ignore
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={s.loading} edges={['top']}>
        <ActivityIndicator size="large" color={cc.primary} />
      </SafeAreaView>
    );
  }

  if (!txn) {
    return (
      <SafeAreaView style={s.container} edges={['top']}>
        <View style={[s.header, { backgroundColor: cc.header }]}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={24} color={C.white} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Transaction Invoice</Text>
        </View>
        <View style={s.empty}>
          <Ionicons name="alert-circle-outline" size={56} color={C.gray} />
          <Text style={s.emptyTitle}>Transaction not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isIncoming = txn.transaction_type === 'deposit';
  const reference = txn.id.slice(0, 12).toUpperCase();
  const recipientBank = txn.recipient_bank_name || (txn.recipient_sort_code ? 'UK Bank' : null);

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={[s.header, { backgroundColor: cc.header }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} testID="back-btn">
          <Ionicons name="arrow-back" size={24} color={C.white} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Transaction Invoice</Text>
        <TouchableOpacity onPress={handleShare} style={s.shareBtn} testID="share-btn">
          <Ionicons name="share-outline" size={22} color={C.white} />
        </TouchableOpacity>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Status Icon + Amount */}
        <View style={s.heroSection}>
          <View style={[s.statusCircle, { backgroundColor: txn.status === 'completed' ? C.success : C.warning }]}>
            <Ionicons name={txn.status === 'completed' ? 'checkmark' : 'time'} size={36} color={C.white} />
          </View>
          <Text style={s.statusLabel}>
            {txn.status === 'completed' ? (isIncoming ? 'Received' : 'Payment Sent') : 'Pending'}
          </Text>
          <Text style={[s.amount, { color: isIncoming ? C.success : cc.primary }]}>
            {isIncoming ? '+' : '-'}{fmt(txn.amount)}
          </Text>
          <Text style={s.amountSubtext}>{txn.description}</Text>
        </View>

        {/* Invoice Card */}
        <View style={s.invoiceCard}>
          <View style={s.invoiceHeader}>
            <Ionicons name="receipt" size={20} color={cc.primary} />
            <Text style={[s.invoiceTitle, { color: cc.primary }]}>Invoice Details</Text>
          </View>
          <View style={s.invoiceDivider} />

          <InvoiceRow label="Reference" value={reference} mono />
          {txn.trn && <InvoiceRow label="TRN" value={txn.trn} mono />}
          {txn.fpid && <InvoiceRow label="FPID" value={txn.fpid} mono />}
          <InvoiceRow label="Date & Time" value={formatDateTime(txn.timestamp)} />
          <InvoiceRow label="Transaction Type" value={txn.transaction_type.charAt(0).toUpperCase() + txn.transaction_type.slice(1)} />
          <InvoiceRow label="Status" value={txn.status.charAt(0).toUpperCase() + txn.status.slice(1)} valueColor={txn.status === 'completed' ? C.success : C.warning} />

          {/* Recipient Block */}
          {(txn.recipient_name || txn.recipient_account_number) && (
            <>
              <View style={s.sectionGap} />
              <Text style={s.sectionHeader}>{isIncoming ? 'From' : 'To'}</Text>
              {txn.recipient_name && <InvoiceRow label="Name" value={txn.recipient_name} />}
              {recipientBank && <InvoiceRow label="Bank" value={recipientBank} />}
              {txn.recipient_sort_code && <InvoiceRow label="Sort Code" value={txn.recipient_sort_code} mono />}
              {txn.recipient_account_number && <InvoiceRow label="Account Number" value={txn.recipient_account_number} mono />}
            </>
          )}

          {/* From Account Block */}
          {fromAccount && !isIncoming && (
            <>
              <View style={s.sectionGap} />
              <Text style={s.sectionHeader}>From</Text>
              <InvoiceRow
                label="Account"
                value={`${fromAccount.account_type === 'checking' ? 'Current' : 'Savings'} ****${(fromAccount.account_number || '').slice(-4)}`}
              />
              {fromAccount.sort_code && <InvoiceRow label="Sort Code" value={fromAccount.sort_code} mono />}
            </>
          )}

          {/* Amount Summary */}
          <View style={s.sectionGap} />
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Total</Text>
            <Text style={[s.totalValue, { color: cc.primary }]}>{fmt(txn.amount)}</Text>
          </View>
        </View>

        {/* Footer Card */}
        <View style={s.footerCard}>
          <Ionicons name="shield-checkmark" size={18} color={C.success} />
          <Text style={s.footerText}>Secured by HSBC. Keep this invoice for your records.</Text>
        </View>

        {/* Actions */}
        <TouchableOpacity
          style={[s.downloadBtn, { backgroundColor: cc.primary }]}
          onPress={handleDownload}
          disabled={isDownloading}
          testID="download-pdf-btn"
        >
          {isDownloading ? (
            <ActivityIndicator color={C.white} />
          ) : (
            <>
              <Ionicons name="download-outline" size={18} color={C.white} />
              <Text style={s.downloadBtnText}>Download PDF Receipt</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={s.secondaryBtn} onPress={() => router.back()}>
          <Text style={s.secondaryBtnText}>Done</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function InvoiceRow({ label, value, mono, valueColor }: { label: string; value: string; mono?: boolean; valueColor?: string }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={[s.rowValue, mono && s.mono, valueColor ? { color: valueColor } : null]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  loading: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' },
  backBtn: { marginRight: 12, padding: 4 },
  shareBtn: { marginLeft: 'auto', padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: C.white },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  heroSection: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 24 },
  statusCircle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  statusLabel: { fontSize: 16, fontWeight: '600', color: C.darkGray, marginBottom: 4 },
  amount: { fontSize: 36, fontWeight: '700', marginBottom: 6 },
  amountSubtext: { fontSize: 13, color: C.gray, textAlign: 'center' },
  invoiceCard: { backgroundColor: C.white, marginHorizontal: 16, borderRadius: 12, padding: 18, borderWidth: 1, borderColor: C.border },
  invoiceHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  invoiceTitle: { fontSize: 15, fontWeight: '700', marginLeft: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  invoiceDivider: { height: 1, backgroundColor: C.lightGray, marginBottom: 12 },
  sectionGap: { height: 14 },
  sectionHeader: { fontSize: 12, fontWeight: '700', color: C.gray, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 7 },
  rowLabel: { fontSize: 13, color: C.gray, flex: 1, marginRight: 12 },
  rowValue: { fontSize: 14, fontWeight: '600', color: C.darkGray, flex: 1.4, textAlign: 'right' },
  mono: { letterSpacing: 0.8 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 14, borderTopWidth: 1, borderTopColor: C.lightGray, marginTop: 6 },
  totalLabel: { fontSize: 15, fontWeight: '700', color: C.darkGray },
  totalValue: { fontSize: 22, fontWeight: '700' },
  footerCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F5F4', marginHorizontal: 16, marginTop: 14, padding: 12, borderRadius: 8 },
  footerText: { fontSize: 12, color: C.darkGray, marginLeft: 8, flex: 1 },
  downloadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginHorizontal: 16, marginTop: 18, height: 50, borderRadius: 8 },
  downloadBtnText: { color: C.white, fontSize: 15, fontWeight: '600', marginLeft: 8 },
  secondaryBtn: { marginHorizontal: 16, marginTop: 10, height: 48, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white, borderWidth: 1, borderColor: C.border },
  secondaryBtnText: { fontSize: 15, fontWeight: '600', color: C.darkGray },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  emptyTitle: { fontSize: 16, color: C.gray, marginTop: 10 },
});
