import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import AppLogo from '../src/components/AppLogo';
import HeaderInfoButton from '../src/components/HeaderInfoButton';
import { transactionsApi, accountsApi, Transaction, Account } from '../src/services/api';
import { useCustomization } from '../src/context/CustomizationContext';
import { getBankTheme, getFooterTagline } from '../src/context/BankThemes';

const C = {
  white: '#FFFFFF',
  bg: '#F5F5F5',
  ink: '#0B1424',
  midInk: '#5E6A7A',
  softLine: '#EFEFEF',
  greenAccent: '#00847F',
};

/**
 * TransactionDetail — visual identical to the "Transfer complete" receipt
 * so the user sees the same HSBC UK receipt regardless of whether they
 * just made the transfer or tapped one from Recent Activity.
 */
export default function TransactionDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors: cc, bankThemeId } = useCustomization();
  const bankName = getBankTheme(bankThemeId).name;
  const footerTag = getFooterTagline(bankThemeId);
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
        } catch {
          /* ignore */
        }
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to load transaction');
    } finally {
      setIsLoading(false);
    }
  };

  const fmt = (v: number) =>
    new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(v);

  const fmtDateTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short' });
  };

  const copyToClipboard = async (val: string, label: string) => {
    try {
      await Clipboard.setStringAsync(val);
      if (Platform.OS !== 'web') {
        Alert.alert(`${label} copied`, val);
      }
    } catch {
      /* ignore */
    }
  };

  const handleDownload = async () => {
    if (!txn) return;
    setIsDownloading(true);
    try {
      const { downloadReceipt } = await import('../src/services/offline-docs');
      await downloadReceipt(txn as any);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to download receipt.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShare = async () => {
    if (!txn) return;
    const ref = txn.id.slice(0, 12).toUpperCase();
    const lines = [
      `${bankName} Transaction Receipt`,
      `Reference: ${ref}`,
      `Date: ${fmtDateTime(txn.timestamp)}`,
      `Amount: ${txn.transaction_type === 'deposit' ? '+' : '-'}${fmt(txn.amount)}`,
      `Recipient: ${txn.recipient_name || 'N/A'}`,
      txn.recipient_sort_code ? `Sort Code: ${txn.recipient_sort_code}` : '',
      txn.recipient_account_number ? `Account: ${txn.recipient_account_number}` : '',
      `Status: ${txn.status}`,
    ]
      .filter(Boolean)
      .join('\n');
    try {
      await Share.share({ message: lines, title: 'Transaction Receipt' });
    } catch {
      /* ignore */
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
        <View style={s.emptyWrap}>
          <Ionicons name="alert-circle-outline" size={56} color={C.midInk} />
          <Text style={s.emptyTitle}>Transaction not found</Text>
          <TouchableOpacity onPress={() => router.back()} style={[s.emptyBtn, { backgroundColor: cc.primary }]}>
            <Text style={s.emptyBtnText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isIncoming = txn.transaction_type === 'deposit';
  const reference = txn.reference || txn.id.slice(0, 12).toUpperCase();
  const trn = txn.trn || `TRN${txn.id.slice(0, 12).toUpperCase()}`;
  const fpid = txn.fpid || `FP${txn.id.slice(0, 15).toUpperCase()}`;
  const txnId = txn.id.slice(0, 12).toUpperCase();
  const fromLabel = fromAccount
    ? fromAccount.account_type === 'checking'
      ? 'Current Account'
      : 'Savings Account'
    : 'Current Account';
  const fromSort = fromAccount?.sort_code || '';
  const fromAcct = fromAccount?.account_number ? `****${fromAccount.account_number.slice(-4)}` : '';

  const CopyBtn = ({ value, label, testID }: { value: string; label: string; testID?: string }) => (
    <TouchableOpacity
      onPress={() => copyToClipboard(value, label)}
      style={s.copyBtn}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      testID={testID}
    >
      <Ionicons name="copy-outline" size={16} color="#5E6A7A" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* -------- HSBC-style brand header -------- */}
        <View style={s.brandBar}>
          <View style={s.brandLeft}>
            <TouchableOpacity onPress={() => router.back()} style={s.backChip} testID="back-btn">
              <Ionicons name="chevron-back" size={20} color={C.ink} />
            </TouchableOpacity>
            <AppLogo variant="header" />
          </View>
          <View style={s.brandRight}>
            <TouchableOpacity style={s.iconBtn} onPress={handleShare} testID="share-btn">
              <Ionicons name="search-outline" size={22} color={C.ink} />
              <Text style={s.iconLbl}>Search</Text>
            </TouchableOpacity>
            <View style={s.iconBtn}>
              <View>
                <Ionicons name="notifications-outline" size={22} color={C.ink} />
                <View style={[s.badge, { backgroundColor: cc.primary }]}>
                  <Text style={s.badgeText}>3</Text>
                </View>
              </View>
              <Text style={s.iconLbl}>Alerts</Text>
            </View>
            <View style={s.iconBtn}>
              <HeaderInfoButton tint={C.ink} size={22} />
              <Text style={s.iconLbl}>Menu</Text>
            </View>
          </View>
        </View>

        {/* -------- Success block -------- */}
        <View style={s.successBlock}>
          <View style={s.checkRing}>
            <Ionicons name="checkmark" size={30} color={C.greenAccent} />
          </View>
          <Text style={s.title}>{isIncoming ? 'Payment received' : 'Transfer complete'}</Text>
          <Text style={s.subtitle}>
            {isIncoming
              ? 'Funds have been credited to your account.'
              : 'Your payment has been sent successfully.'}
          </Text>
        </View>

        {/* -------- Main payment card -------- */}
        <View style={s.card}>
          <View style={s.row}>
            <Text style={s.rowLabel}>From</Text>
            <View style={s.rowValueRight}>
              <Text style={s.rowVal}>{fromLabel}</Text>
              {(fromSort || fromAcct) && (
                <Text style={s.rowSub}>
                  {fromSort} {fromAcct ? `  ${fromAcct}` : ''}
                </Text>
              )}
            </View>
          </View>
          <View style={s.divider} />
          <View style={s.row}>
            <Text style={s.rowLabel}>{isIncoming ? 'From payer' : 'To'}</Text>
            <View style={s.rowValueRight}>
              <Text style={s.rowVal}>{txn.recipient_name || 'N/A'}</Text>
              {(txn.recipient_sort_code || txn.recipient_account_number) && (
                <Text style={s.rowSub}>
                  {txn.recipient_sort_code || ''} {txn.recipient_account_number ? `  ${txn.recipient_account_number}` : ''}
                </Text>
              )}
            </View>
          </View>
          <View style={s.divider} />
          <View style={s.row}>
            <Text style={s.rowLabel}>Amount</Text>
            <Text style={[s.rowVal, { fontWeight: '800' }]}>
              {isIncoming ? '+' : '−'}
              {fmt(txn.amount)}
            </Text>
          </View>
          <View style={s.divider} />
          <View style={s.row}>
            <Text style={s.rowLabel}>Date and time</Text>
            <Text style={s.rowVal}>{fmtDateTime(txn.timestamp)}</Text>
          </View>
          <View style={s.divider} />
          <View style={s.row}>
            <Text style={s.rowLabel}>Reference</Text>
            <Text style={s.rowVal}>{reference}</Text>
          </View>
          <View style={s.divider} />
          <View style={s.row}>
            <Text style={s.rowLabel}>Status</Text>
            <View style={[s.statusPill, txn.status !== 'completed' && { backgroundColor: '#FFF3D6' }]}>
              <Text style={[s.statusText, txn.status !== 'completed' && { color: '#8A6800' }]}>
                {txn.status.charAt(0).toUpperCase() + txn.status.slice(1)}
              </Text>
            </View>
          </View>
        </View>

        {/* -------- Transaction details card -------- */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Transaction details</Text>
          <View style={s.divider} />
          <View style={s.row}>
            <Text style={s.rowLabel}>Transaction ID</Text>
            <View style={s.copyValRow}>
              <Text style={[s.rowVal, s.mono, { flex: 0 }]}>{txnId}</Text>
              <CopyBtn value={txnId} label="Transaction ID" testID="td-copy-txn" />
            </View>
          </View>
          <View style={s.divider} />
          <View style={s.row}>
            <Text style={s.rowLabel}>FPID</Text>
            <View style={s.copyValRow}>
              <Text style={[s.rowVal, s.mono, { flex: 0 }]}>{fpid}</Text>
              <CopyBtn value={fpid} label="FPID" testID="td-copy-fpid" />
            </View>
          </View>
          <View style={s.divider} />
          <View style={s.row}>
            <Text style={s.rowLabel}>TRN</Text>
            <View style={s.copyValRow}>
              <Text style={[s.rowVal, s.mono, { flex: 0 }]}>{trn}</Text>
              <CopyBtn value={trn} label="TRN" testID="td-copy-trn" />
            </View>
          </View>
          <View style={s.divider} />
          <View style={s.row}>
            <Text style={s.rowLabel}>Payment method</Text>
            <Text style={s.rowVal}>Faster Payment</Text>
          </View>
        </View>

        {/* -------- Confirmation banner -------- */}
        <View style={[s.confirmBanner, { borderLeftColor: cc.primary }]}>
          <Ionicons name="shield-checkmark-outline" size={22} color={C.ink} style={{ marginRight: 10 }} />
          <View style={{ flex: 1 }}>
            <Text style={s.confirmTitle}>Confirmation</Text>
            <Text style={s.confirmBody}>
              This is confirmation that your payment{isIncoming ? ' was received' : ' has been sent'} successfully.
            </Text>
          </View>
        </View>

        {/* -------- Action buttons -------- */}
        <View style={s.actionRow}>
          <TouchableOpacity
            style={s.actionBtn}
            onPress={handleDownload}
            disabled={isDownloading}
            testID="td-save"
          >
            <View style={[s.actionCircle, { backgroundColor: cc.primary + '18' }]}>
              {isDownloading ? (
                <ActivityIndicator color={cc.primary} size="small" />
              ) : (
                <Ionicons name="download-outline" size={22} color={cc.primary} />
              )}
            </View>
            <Text style={s.actionLabel}>Save receipt</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.actionBtn} onPress={handleShare} testID="td-email">
            <View style={[s.actionCircle, { backgroundColor: cc.primary + '18' }]}>
              <Ionicons name="mail-outline" size={22} color={cc.primary} />
            </View>
            <Text style={s.actionLabel}>Email receipt</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.actionBtn} onPress={handleShare} testID="td-share">
            <View style={[s.actionCircle, { backgroundColor: cc.primary + '18' }]}>
              <Ionicons name="share-outline" size={22} color={cc.primary} />
            </View>
            <Text style={s.actionLabel}>Share</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.actionBtn}
            onPress={() => router.replace('/(tabs)/home' as any)}
            testID="td-home"
          >
            <View style={[s.actionCircle, { backgroundColor: cc.primary + '18' }]}>
              <Ionicons name="home-outline" size={22} color={cc.primary} />
            </View>
            <Text style={s.actionLabel}>Back to home</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.footerTag}>{footerTag}</Text>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  loading: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { padding: 16, paddingBottom: 40 },

  // brand bar
  brandBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingTop: 6,
    paddingBottom: 18,
  },
  brandLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backChip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF1F4',
    marginRight: 8,
  },
  brandRight: { flexDirection: 'row', alignItems: 'flex-start' },
  iconBtn: { alignItems: 'center', marginLeft: 14, width: 52 },
  iconLbl: { fontSize: 10, color: C.midInk, marginTop: 4, fontWeight: '500' },
  badge: {
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
  badgeText: { color: C.white, fontSize: 9, fontWeight: '700' },

  // success block
  successBlock: { alignItems: 'center', paddingTop: 6, paddingBottom: 20 },
  checkRing: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: C.greenAccent,
    backgroundColor: C.white,
    marginBottom: 12,
  },
  title: { fontSize: 26, fontWeight: '700', color: C.ink },
  subtitle: { fontSize: 14, color: C.midInk, marginTop: 4, textAlign: 'center' },

  // cards / rows
  card: {
    backgroundColor: C.white,
    borderRadius: 8,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: C.softLine,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: C.ink, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  rowLabel: { fontSize: 13, color: C.ink, width: 120 },
  rowVal: { fontSize: 14, fontWeight: '600', color: C.ink, flex: 1, textAlign: 'right' },
  rowSub: { fontSize: 12, color: C.midInk, marginTop: 2 },
  rowValueRight: { flex: 1, alignItems: 'flex-end' },
  divider: { height: 1, backgroundColor: '#F1F2F4' },
  mono: { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },

  // status pill
  statusPill: { backgroundColor: '#D6F0EA', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 4 },
  statusText: { color: '#00695B', fontSize: 12, fontWeight: '700' },

  // copy
  copyBtn: { marginLeft: 8, padding: 2 },
  copyValRow: { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'flex-end' },

  // confirm banner
  confirmBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F7F8FA',
    borderLeftWidth: 4,
    borderRadius: 6,
    padding: 14,
    marginBottom: 18,
  },
  confirmTitle: { fontSize: 14, fontWeight: '700', color: C.ink },
  confirmBody: { fontSize: 12, color: C.midInk, marginTop: 3, lineHeight: 16 },

  // actions
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  actionBtn: { alignItems: 'center', flex: 1 },
  actionCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  actionLabel: { fontSize: 11, color: C.ink, textAlign: 'center', fontWeight: '500' },

  footerTag: { fontSize: 11, color: '#8893A3', textAlign: 'center', marginTop: 6, letterSpacing: 0.4 },

  // empty
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  emptyTitle: { fontSize: 16, color: C.midInk, marginTop: 10, marginBottom: 20 },
  emptyBtn: { paddingHorizontal: 22, paddingVertical: 12, borderRadius: 8 },
  emptyBtnText: { color: C.white, fontWeight: '700' },
});
