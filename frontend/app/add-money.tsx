import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { accountsApi, depositsApi, Account } from '../src/services/api';
import { useCustomization } from '../src/context/CustomizationContext';

const COLORS = { white: '#FFFFFF', lightGray: '#F5F5F5', gray: '#767676', darkGray: '#333333', black: '#000000', success: '#00847F', background: '#F5F5F5' };

const QUICK_AMOUNTS = [50, 100, 250, 500];

const SOURCES = [
  { key: 'bank_transfer', label: 'Bank Transfer', icon: 'swap-horizontal' as const, desc: 'From another bank' },
  { key: 'card_deposit', label: 'Card Deposit', icon: 'card' as const, desc: 'From debit/credit card' },
  { key: 'quick_topup', label: 'Quick Top-up', icon: 'flash' as const, desc: 'Instant deposit' },
];

export default function AddMoneyScreen() {
  const router = useRouter();
  const { colors: customColors } = useCustomization();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [amount, setAmount] = useState('');
  const [selectedSource, setSelectedSource] = useState('bank_transfer');
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [newBalance, setNewBalance] = useState(0);

  useEffect(() => { fetchAccounts(); }, []);

  const fetchAccounts = async () => {
    try {
      const res = await accountsApi.getAll();
      setAccounts(res.data);
      if (res.data.length > 0) setSelectedAccount(res.data[0]);
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  };

  const fmt = (v: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(v);

  const handleQuickAmount = (val: number) => {
    setAmount(val.toString());
  };

  const handleDeposit = async () => {
    if (!selectedAccount) { Alert.alert('Error', 'Please select an account'); return; }
    const val = parseFloat(amount);
    if (!val || val <= 0) { Alert.alert('Error', 'Please enter a valid amount'); return; }

    setIsProcessing(true);
    try {
      const res = await depositsApi.addMoney({
        account_id: selectedAccount.id,
        amount: val,
        source: selectedSource,
      });
      setNewBalance(res.data.new_balance);
      setSuccess(true);
    } catch (e: any) {
      Alert.alert('Failed', e.response?.data?.detail || 'Unable to add money');
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) return <SafeAreaView style={styles.loading}><ActivityIndicator size="large" color={customColors.primary} /></SafeAreaView>;

  if (success) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.successContainer}>
          <View style={[styles.successCircle, { backgroundColor: COLORS.success }]}>
            <Ionicons name="checkmark" size={48} color={COLORS.white} />
          </View>
          <Text style={styles.successTitle}>Money Added!</Text>
          <Text style={styles.successAmount}>{fmt(parseFloat(amount))}</Text>
          <Text style={styles.successSubtext}>
            Added to your {selectedAccount?.account_type === 'checking' ? 'Current' : 'Savings'} Account
          </Text>
          <Text style={styles.successBalance}>New Balance: {fmt(newBalance)}</Text>
          <TouchableOpacity style={[styles.doneBtn, { backgroundColor: customColors.primary }]} onPress={() => router.back()} testID="done-btn">
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addMoreBtn} onPress={() => { setSuccess(false); setAmount(''); }} testID="add-more-btn">
            <Text style={[styles.addMoreBtnText, { color: customColors.primary }]}>Add More Money</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={[styles.header, { backgroundColor: customColors.header }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="back-btn">
          <Ionicons name="arrow-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Money</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Account Selector */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>To Account</Text>
            <TouchableOpacity style={styles.accountCard} onPress={() => setShowAccountPicker(!showAccountPicker)} testID="account-selector">
              {selectedAccount && (
                <>
                  <View style={styles.accountLeft}>
                    <View style={[styles.accountDot, { backgroundColor: selectedAccount.account_type === 'checking' ? customColors.primary : COLORS.success }]} />
                    <View>
                      <Text style={styles.accountType}>{selectedAccount.account_type === 'checking' ? 'Current Account' : 'Savings Account'}</Text>
                      <Text style={styles.accountNum}>****{selectedAccount.account_number.slice(-4)}</Text>
                    </View>
                  </View>
                  <View style={styles.accountRight}>
                    <Text style={styles.accountBal}>{fmt(selectedAccount.balance)}</Text>
                    <Ionicons name={showAccountPicker ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.gray} />
                  </View>
                </>
              )}
            </TouchableOpacity>
            {showAccountPicker && (
              <View style={styles.picker}>
                {accounts.map((acc) => (
                  <TouchableOpacity key={acc.id} style={[styles.pickerItem, selectedAccount?.id === acc.id && { backgroundColor: `${customColors.primary}10` }]}
                    onPress={() => { setSelectedAccount(acc); setShowAccountPicker(false); }}>
                    <Text style={styles.pickerText}>{acc.account_type === 'checking' ? 'Current' : 'Savings'} — {fmt(acc.balance)}</Text>
                    {selectedAccount?.id === acc.id && <Ionicons name="checkmark" size={18} color={customColors.primary} />}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Amount */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Amount</Text>
            <View style={styles.amountCard}>
              <View style={[styles.amountRow, { borderBottomColor: customColors.primary }]}>
                <Text style={styles.currency}>£</Text>
                <TextInput style={styles.amountInput} placeholder="0.00" placeholderTextColor={COLORS.gray} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" testID="amount-input" />
              </View>
            </View>
            {/* Quick amounts */}
            <View style={styles.quickRow}>
              {QUICK_AMOUNTS.map((val) => (
                <TouchableOpacity key={val} style={[styles.quickBtn, amount === val.toString() && { backgroundColor: customColors.primary }]}
                  onPress={() => handleQuickAmount(val)} testID={`quick-${val}`}>
                  <Text style={[styles.quickBtnText, amount === val.toString() && { color: COLORS.white }]}>£{val}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Source */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Source</Text>
            {SOURCES.map((src) => (
              <TouchableOpacity key={src.key} style={[styles.sourceCard, selectedSource === src.key && { borderColor: customColors.primary, borderWidth: 2 }]}
                onPress={() => setSelectedSource(src.key)} testID={`source-${src.key}`}>
                <View style={[styles.sourceIcon, { backgroundColor: selectedSource === src.key ? `${customColors.primary}15` : COLORS.lightGray }]}>
                  <Ionicons name={src.icon} size={22} color={selectedSource === src.key ? customColors.primary : COLORS.gray} />
                </View>
                <View style={styles.sourceInfo}>
                  <Text style={styles.sourceLabel}>{src.label}</Text>
                  <Text style={styles.sourceDesc}>{src.desc}</Text>
                </View>
                {selectedSource === src.key && <Ionicons name="checkmark-circle" size={22} color={customColors.primary} />}
              </TouchableOpacity>
            ))}
          </View>

          {/* Deposit Button */}
          <TouchableOpacity style={[styles.depositBtn, isProcessing && { opacity: 0.7 }, { backgroundColor: customColors.primary }]}
            onPress={handleDeposit} disabled={isProcessing} testID="deposit-btn">
            {isProcessing ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <>
                <Ionicons name="add-circle" size={22} color={COLORS.white} />
                <Text style={styles.depositBtnText}>Add Money</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loading: { flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' },
  backBtn: { marginRight: 16 },
  headerTitle: { fontSize: 20, fontWeight: '600', color: COLORS.white },
  scroll: { flex: 1 },
  section: { marginHorizontal: 16, marginBottom: 20 },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: COLORS.darkGray, marginBottom: 10 },
  accountCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.white, borderRadius: 8, padding: 16 },
  accountLeft: { flexDirection: 'row', alignItems: 'center' },
  accountDot: { width: 8, height: 8, borderRadius: 4, marginRight: 12 },
  accountType: { fontSize: 15, fontWeight: '600', color: COLORS.darkGray },
  accountNum: { fontSize: 13, color: COLORS.gray, marginTop: 2 },
  accountRight: { flexDirection: 'row', alignItems: 'center' },
  accountBal: { fontSize: 15, fontWeight: '600', color: COLORS.darkGray, marginRight: 8 },
  picker: { backgroundColor: COLORS.white, borderRadius: 8, marginTop: 8, padding: 8 },
  pickerItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 6 },
  pickerText: { fontSize: 14, color: COLORS.darkGray },
  amountCard: { backgroundColor: COLORS.white, borderRadius: 8, padding: 20 },
  amountRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 2, paddingBottom: 12 },
  currency: { fontSize: 32, fontWeight: '700', color: COLORS.darkGray, marginRight: 8 },
  amountInput: { flex: 1, fontSize: 36, fontWeight: '700', color: COLORS.darkGray },
  quickRow: { flexDirection: 'row', marginTop: 12, justifyContent: 'space-between' },
  quickBtn: { flex: 1, marginHorizontal: 4, paddingVertical: 12, borderRadius: 8, backgroundColor: COLORS.white, alignItems: 'center' },
  quickBtnText: { fontSize: 15, fontWeight: '600', color: COLORS.darkGray },
  sourceCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderRadius: 8, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#E0E0E0' },
  sourceIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  sourceInfo: { flex: 1 },
  sourceLabel: { fontSize: 15, fontWeight: '600', color: COLORS.darkGray },
  sourceDesc: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  depositBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 52, borderRadius: 4, marginHorizontal: 16, marginTop: 4 },
  depositBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '600', marginLeft: 8 },
  // Success
  successContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  successCircle: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  successTitle: { fontSize: 24, fontWeight: '700', color: COLORS.darkGray, marginBottom: 8 },
  successAmount: { fontSize: 40, fontWeight: '700', color: COLORS.success, marginBottom: 8 },
  successSubtext: { fontSize: 15, color: COLORS.gray, marginBottom: 16 },
  successBalance: { fontSize: 16, fontWeight: '600', color: COLORS.darkGray, marginBottom: 32 },
  doneBtn: { width: '100%', height: 52, borderRadius: 4, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  doneBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '600' },
  addMoreBtn: { padding: 12 },
  addMoreBtnText: { fontSize: 16, fontWeight: '600' },
});
