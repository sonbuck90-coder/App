import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { cardsApi, transactionsApi, Card, Transaction } from '../src/services/api';
import { useCustomization } from '../src/context/CustomizationContext';
import { useAuth } from '../src/context/AuthContext';

const C = { white: '#FFFFFF', lightGray: '#F2F2F2', gray: '#767676', darkGray: '#333333', black: '#000000', success: '#00847F', bg: '#F5F5F5' };

export default function CardDetailsScreen() {
  const router = useRouter();
  const { cardId } = useLocalSearchParams<{ cardId: string }>();
  const { colors: cc } = useCustomization();
  const { user } = useAuth();
  const [card, setCard] = useState<Card | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showFullNumber, setShowFullNumber] = useState(false);
  const [processingFreeze, setProcessingFreeze] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const [cardsRes, txnRes] = await Promise.all([cardsApi.getAll(), transactionsApi.getAll(20)]);
      const found = cardsRes.data.find((c: Card) => c.id === cardId);
      if (found) setCard(found);
      setTransactions(txnRes.data);
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  };

  const fmt = (v: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(v);

  const formatDate = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  const toggleFreeze = async () => {
    if (!card) return;
    setProcessingFreeze(true);
    try {
      if (card.is_frozen) { await cardsApi.unfreeze(card.id); Alert.alert('Card Activated', 'Your card is now active'); }
      else { await cardsApi.freeze(card.id); Alert.alert('Card Frozen', 'Your card has been temporarily frozen'); }
      load();
    } catch (e: any) { Alert.alert('Error', e.response?.data?.detail || 'Failed'); }
    finally { setProcessingFreeze(false); }
  };

  const getIcon = (type: string): keyof typeof Ionicons.glyphMap => {
    switch (type) { case 'transfer': return 'arrow-forward'; case 'payment': return 'receipt'; case 'deposit': return 'arrow-down'; default: return 'cash'; }
  };
  const getIconColor = (type: string) => {
    switch (type) { case 'transfer': return '#007AFF'; case 'payment': return '#FF9500'; case 'deposit': return C.success; default: return C.gray; }
  };

  if (isLoading) return <SafeAreaView style={styles.loading}><ActivityIndicator size="large" color={cc.primary} /></SafeAreaView>;
  if (!card) return <SafeAreaView style={styles.loading}><Text style={{ color: C.gray }}>Card not found</Text></SafeAreaView>;

  // Format full card number as groups of 4
  const fullNumber = card.card_number || '';
  const displayNumber = showFullNumber
    ? fullNumber.replace(/(.{4})/g, '$1 ').trim()
    : `**** **** **** ${fullNumber.slice(-4)}`;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: cc.primary }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="back-btn">
          <Ionicons name="arrow-back" size={24} color={C.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Card Details</Text>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Card Visual */}
        <View style={styles.cardSection}>
          <View style={[styles.bankCard, card.is_frozen && { opacity: 0.6 }]}>
            {card.is_frozen && (
              <View style={styles.frozenBanner}><Ionicons name="snow" size={14} color={C.white} /><Text style={styles.frozenText}>FROZEN</Text></View>
            )}
            <View style={styles.cardTop}>
              <View style={styles.cardLogoRow}>
                <View style={styles.hsbcLogo}>
                  <View style={styles.hexRow}><View style={[styles.hex, { backgroundColor: cc.primary }]} /><View style={[styles.hex, { backgroundColor: C.white, borderWidth: 1, borderColor: cc.primary }]} /></View>
                  <View style={styles.hexRow}><View style={[styles.hex, { backgroundColor: C.white, borderWidth: 1, borderColor: cc.primary }]} /><View style={[styles.hex, { backgroundColor: cc.primary }]} /></View>
                </View>
                <Text style={styles.cardBankName}>HSBC UK</Text>
              </View>
              <View style={styles.typeBadge}><Text style={styles.typeBadgeText}>{card.card_type === 'debit' ? 'Debit' : 'Credit'}</Text></View>
            </View>
            <Text style={styles.cardNumber}>{displayNumber}</Text>
            <View style={styles.cardBottom}>
              <View><Text style={styles.cardLabel}>VALID THRU</Text><Text style={styles.cardValue}>{card.expiry_date}</Text></View>
              <View><Text style={styles.cardLabel}>CARDHOLDER</Text><Text style={styles.cardValue}>{user?.name || 'HSBC Customer'}</Text></View>
            </View>
          </View>
        </View>

        {/* Card Info */}
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Card Information</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Card Name</Text>
              <Text style={styles.infoValue}>{card.card_name}</Text>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Card Number</Text>
              <TouchableOpacity style={styles.infoValueRow} onPress={() => setShowFullNumber(!showFullNumber)} testID="toggle-number">
                <Text style={styles.infoValue}>{displayNumber}</Text>
                <Ionicons name={showFullNumber ? 'eye-off-outline' : 'eye-outline'} size={18} color={cc.primary} style={{ marginLeft: 8 }} />
              </TouchableOpacity>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Expiry Date</Text>
              <Text style={styles.infoValue}>{card.expiry_date}</Text>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Card Type</Text>
              <Text style={styles.infoValue}>{card.card_type === 'debit' ? 'Visa Debit' : 'Mastercard Credit'}</Text>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Status</Text>
              <View style={[styles.statusPill, { backgroundColor: card.is_frozen ? '#FFF3E0' : '#E8F5E9' }]}>
                <Text style={[styles.statusText, { color: card.is_frozen ? '#E65100' : C.success }]}>{card.is_frozen ? 'Frozen' : 'Active'}</Text>
              </View>
            </View>
            {card.card_type === 'credit' && card.credit_limit && (
              <>
                <View style={styles.infoDivider} />
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Credit Limit</Text>
                  <Text style={styles.infoValue}>{fmt(card.credit_limit)}</Text>
                </View>
                <View style={styles.infoDivider} />
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Available Credit</Text>
                  <Text style={[styles.infoValue, { color: C.success }]}>{fmt(card.available_credit || 0)}</Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsSection}>
          <TouchableOpacity style={[styles.freezeBtn, card.is_frozen ? { backgroundColor: C.success } : { backgroundColor: '#E65100' }]}
            onPress={toggleFreeze} disabled={processingFreeze} testID="freeze-toggle-btn">
            {processingFreeze ? <ActivityIndicator color={C.white} /> : (
              <><Ionicons name={card.is_frozen ? 'play' : 'snow'} size={20} color={C.white} /><Text style={styles.freezeBtnText}>{card.is_frozen ? 'Unfreeze Card' : 'Freeze Card'}</Text></>
            )}
          </TouchableOpacity>
        </View>

        {/* Recent Transactions */}
        <View style={styles.txnSection}>
          <Text style={styles.sectionTitle}>Recent Card Transactions</Text>
          {transactions.length === 0 ? (
            <View style={styles.emptyTxn}>
              <Ionicons name="receipt-outline" size={40} color={C.gray} />
              <Text style={styles.emptyTxnText}>No transactions yet</Text>
            </View>
          ) : (
            <View style={styles.txnCard}>
              {transactions.slice(0, 10).map((txn, i) => (
                <View key={txn.id} style={[styles.txnRow, i < Math.min(transactions.length, 10) - 1 && styles.txnBorder]}>
                  <View style={[styles.txnIcon, { backgroundColor: `${getIconColor(txn.transaction_type)}15` }]}>
                    <Ionicons name={getIcon(txn.transaction_type)} size={18} color={getIconColor(txn.transaction_type)} />
                  </View>
                  <View style={styles.txnInfo}>
                    <Text style={styles.txnTitle} numberOfLines={1}>{txn.recipient_name || txn.description}</Text>
                    <Text style={styles.txnDate}>{formatDate(txn.timestamp)} · {formatTime(txn.timestamp)}</Text>
                  </View>
                  <Text style={[styles.txnAmount, txn.transaction_type === 'deposit' ? { color: C.success } : { color: C.darkGray }]}>
                    {txn.transaction_type === 'deposit' ? '+' : '-'}{fmt(txn.amount)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  loading: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' },
  backBtn: { marginRight: 16 },
  headerTitle: { fontSize: 20, fontWeight: '600', color: C.white },
  scroll: { flex: 1 },
  // Card
  cardSection: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 12 },
  bankCard: { backgroundColor: '#E0E0E0', borderRadius: 16, padding: 20, height: 200, justifyContent: 'space-between', position: 'relative' },
  frozenBanner: { position: 'absolute', top: 10, right: 10, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, zIndex: 1 },
  frozenText: { color: C.white, fontSize: 10, fontWeight: '700', marginLeft: 4 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardLogoRow: { flexDirection: 'row', alignItems: 'center' },
  hsbcLogo: { marginRight: 10 },
  hexRow: { flexDirection: 'row' },
  hex: { width: 12, height: 12, margin: 0.5 },
  cardBankName: { fontSize: 17, fontWeight: '700', color: C.darkGray },
  typeBadge: { backgroundColor: C.white, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 4 },
  typeBadgeText: { fontSize: 13, fontWeight: '500', color: C.darkGray },
  cardNumber: { fontSize: 18, fontWeight: '600', color: '#555', letterSpacing: 2, textAlign: 'center' },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between' },
  cardLabel: { fontSize: 9, color: '#888', marginBottom: 2, letterSpacing: 0.5 },
  cardValue: { fontSize: 13, fontWeight: '600', color: C.darkGray },
  // Info
  infoSection: { marginHorizontal: 16, marginTop: 8, marginBottom: 16 },
  sectionTitle: { fontSize: 17, fontWeight: '600', color: C.darkGray, marginBottom: 12 },
  infoCard: { backgroundColor: C.white, borderRadius: 8, padding: 4 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 14 },
  infoLabel: { fontSize: 14, color: C.gray },
  infoValue: { fontSize: 14, fontWeight: '600', color: C.darkGray },
  infoValueRow: { flexDirection: 'row', alignItems: 'center' },
  infoDivider: { height: 1, backgroundColor: '#F0F0F0', marginHorizontal: 14 },
  statusPill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 13, fontWeight: '600' },
  // Actions
  actionsSection: { marginHorizontal: 16, marginBottom: 20 },
  freezeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 48, borderRadius: 8 },
  freezeBtnText: { color: C.white, fontSize: 15, fontWeight: '600', marginLeft: 8 },
  // Transactions
  txnSection: { marginHorizontal: 16, marginBottom: 16 },
  emptyTxn: { alignItems: 'center', paddingVertical: 32, backgroundColor: C.white, borderRadius: 8 },
  emptyTxnText: { fontSize: 14, color: C.gray, marginTop: 8 },
  txnCard: { backgroundColor: C.white, borderRadius: 8 },
  txnRow: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  txnBorder: { borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  txnIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  txnInfo: { flex: 1 },
  txnTitle: { fontSize: 14, fontWeight: '600', color: C.darkGray },
  txnDate: { fontSize: 12, color: C.gray, marginTop: 2 },
  txnAmount: { fontSize: 15, fontWeight: '700' },
});
