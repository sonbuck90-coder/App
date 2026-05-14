import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { accountsApi, moveMoneyApi, Account } from '../src/services/api';
import { useCustomization } from '../src/context/CustomizationContext';

const C = { white: '#FFFFFF', lightGray: '#F5F5F5', gray: '#767676', darkGray: '#333333', black: '#000000', success: '#00847F', bg: '#F5F5F5' };
const QUICK = [100, 250, 500, 1000];

export default function MoveMoneyScreen() {
  const router = useRouter();
  const { colors: cc } = useCustomization();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [fromIdx, setFromIdx] = useState(0);
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [resultBalances, setResultBalances] = useState({ from: 0, to: 0 });

  useEffect(() => { load(); }, []);
  const load = async () => { try { const r = await accountsApi.getAll(); setAccounts(r.data); } catch(e){} finally { setIsLoading(false); } };

  const fmt = (v: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(v);
  const fromAcc = accounts[fromIdx];
  const toAcc = accounts.length > 1 ? accounts[fromIdx === 0 ? 1 : 0] : null;
  const swap = () => setFromIdx(fromIdx === 0 ? 1 : 0);
  const label = (a: Account) => a.account_type === 'checking' ? 'Current' : 'Savings';

  const handleMove = async () => {
    if (!fromAcc || !toAcc) return;
    const val = parseFloat(amount);
    if (!val || val <= 0) { Alert.alert('Error', 'Enter a valid amount'); return; }
    if (val > fromAcc.balance) { Alert.alert('Insufficient Funds', `Your ${label(fromAcc)} balance is ${fmt(fromAcc.balance)}`); return; }

    setIsProcessing(true);
    try {
      const res = await moveMoneyApi.transfer({ from_account_id: fromAcc.id, to_account_id: toAcc.id, amount: val });
      setResultBalances({ from: res.data.from_balance, to: res.data.to_balance });
      setSuccess(true);
    } catch (e: any) {
      Alert.alert('Failed', e.response?.data?.detail || 'Transfer failed');
    } finally { setIsProcessing(false); }
  };

  if (isLoading) return <SafeAreaView style={s.loading}><ActivityIndicator size="large" color={cc.primary} /></SafeAreaView>;

  if (success) return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.successWrap}>
        <View style={[s.successCircle, { backgroundColor: C.success }]}><Ionicons name="checkmark" size={48} color={C.white} /></View>
        <Text style={s.successTitle}>Money Moved!</Text>
        <Text style={s.successAmt}>{fmt(parseFloat(amount))}</Text>
        <Text style={s.successSub}>{label(fromAcc!)} → {label(toAcc!)}</Text>
        <View style={s.balCards}>
          <View style={s.balCard}><Text style={s.balLabel}>{label(fromAcc!)}</Text><Text style={s.balVal}>{fmt(resultBalances.from)}</Text></View>
          <Ionicons name="arrow-forward" size={20} color={C.gray} />
          <View style={s.balCard}><Text style={s.balLabel}>{label(toAcc!)}</Text><Text style={[s.balVal, { color: C.success }]}>{fmt(resultBalances.to)}</Text></View>
        </View>
        <TouchableOpacity style={[s.doneBtn, { backgroundColor: cc.primary }]} onPress={() => router.back()} testID="done-btn"><Text style={s.doneTxt}>Done</Text></TouchableOpacity>
        <TouchableOpacity style={s.moreBtn} onPress={() => { setSuccess(false); setAmount(''); }}><Text style={[s.moreTxt, { color: cc.primary }]}>Move More</Text></TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={[s.header, { backgroundColor: cc.header }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} testID="back-btn"><Ionicons name="arrow-back" size={24} color={C.white} /></TouchableOpacity>
        <Text style={s.headerTitle}>Move Money</Text>
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* From / To with Swap */}
          <View style={s.section}>
            {fromAcc && toAcc && (
              <View style={s.accountsRow}>
                <View style={s.accCard}>
                  <Text style={s.accLabel}>From</Text>
                  <View style={[s.accDot, { backgroundColor: cc.primary }]} />
                  <Text style={s.accType}>{label(fromAcc)}</Text>
                  <Text style={s.accNum}>****{fromAcc.account_number.slice(-4)}</Text>
                  <Text style={s.accBal}>{fmt(fromAcc.balance)}</Text>
                </View>
                <TouchableOpacity style={[s.swapBtn, { backgroundColor: cc.primary }]} onPress={swap} testID="swap-btn">
                  <Ionicons name="swap-horizontal" size={22} color={C.white} />
                </TouchableOpacity>
                <View style={s.accCard}>
                  <Text style={s.accLabel}>To</Text>
                  <View style={[s.accDot, { backgroundColor: C.success }]} />
                  <Text style={s.accType}>{label(toAcc)}</Text>
                  <Text style={s.accNum}>****{toAcc.account_number.slice(-4)}</Text>
                  <Text style={s.accBal}>{fmt(toAcc.balance)}</Text>
                </View>
              </View>
            )}
          </View>

          {/* Amount */}
          <View style={s.section}>
            <Text style={s.sLabel}>Amount</Text>
            <View style={s.amtCard}>
              <View style={[s.amtRow, { borderBottomColor: cc.primary }]}>
                <Text style={s.curr}>£</Text>
                <TextInput style={s.amtInput} placeholder="0.00" placeholderTextColor={C.gray} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" testID="amount-input" />
              </View>
            </View>
            <View style={s.quickRow}>
              {QUICK.map(v => (
                <TouchableOpacity key={v} style={[s.qBtn, amount === v.toString() && { backgroundColor: cc.primary }]} onPress={() => setAmount(v.toString())} testID={`quick-${v}`}>
                  <Text style={[s.qTxt, amount === v.toString() && { color: C.white }]}>£{v}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Move Button */}
          <TouchableOpacity style={[s.moveBtn, isProcessing && { opacity: 0.7 }, { backgroundColor: cc.primary }]} onPress={handleMove} disabled={isProcessing} testID="move-btn">
            {isProcessing ? <ActivityIndicator color={C.white} /> : (
              <><Ionicons name="swap-horizontal" size={22} color={C.white} /><Text style={s.moveTxt}>Move Money</Text></>
            )}
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  loading: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' },
  backBtn: { marginRight: 16 },
  headerTitle: { fontSize: 20, fontWeight: '600', color: C.white },
  scroll: { flex: 1 },
  section: { marginHorizontal: 16, marginBottom: 20 },
  sLabel: { fontSize: 14, fontWeight: '600', color: C.darkGray, marginBottom: 10 },
  accountsRow: { flexDirection: 'row', alignItems: 'center' },
  accCard: { flex: 1, backgroundColor: C.white, borderRadius: 12, padding: 16, alignItems: 'center' },
  accLabel: { fontSize: 12, fontWeight: '600', color: C.gray, marginBottom: 8 },
  accDot: { width: 10, height: 10, borderRadius: 5, marginBottom: 8 },
  accType: { fontSize: 16, fontWeight: '700', color: C.darkGray },
  accNum: { fontSize: 12, color: C.gray, marginTop: 4 },
  accBal: { fontSize: 18, fontWeight: '700', color: C.darkGray, marginTop: 8 },
  swapBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginHorizontal: 10 },
  amtCard: { backgroundColor: C.white, borderRadius: 8, padding: 20 },
  amtRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 2, paddingBottom: 12 },
  curr: { fontSize: 32, fontWeight: '700', color: C.darkGray, marginRight: 8 },
  amtInput: { flex: 1, fontSize: 36, fontWeight: '700', color: C.darkGray },
  quickRow: { flexDirection: 'row', marginTop: 12, justifyContent: 'space-between' },
  qBtn: { flex: 1, marginHorizontal: 4, paddingVertical: 12, borderRadius: 8, backgroundColor: C.white, alignItems: 'center' },
  qTxt: { fontSize: 15, fontWeight: '600', color: C.darkGray },
  moveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 52, borderRadius: 4, marginHorizontal: 16, marginTop: 4 },
  moveTxt: { color: C.white, fontSize: 16, fontWeight: '600', marginLeft: 8 },
  // Success
  successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  successCircle: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  successTitle: { fontSize: 24, fontWeight: '700', color: C.darkGray, marginBottom: 8 },
  successAmt: { fontSize: 40, fontWeight: '700', color: C.success, marginBottom: 4 },
  successSub: { fontSize: 15, color: C.gray, marginBottom: 24 },
  balCards: { flexDirection: 'row', alignItems: 'center', marginBottom: 32 },
  balCard: { backgroundColor: C.white, borderRadius: 8, padding: 16, alignItems: 'center', minWidth: 120 },
  balLabel: { fontSize: 12, color: C.gray, marginBottom: 4 },
  balVal: { fontSize: 18, fontWeight: '700', color: C.darkGray },
  doneBtn: { width: '100%', height: 52, borderRadius: 4, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  doneTxt: { color: C.white, fontSize: 16, fontWeight: '600' },
  moreBtn: { padding: 12 },
  moreTxt: { fontSize: 16, fontWeight: '600' },
});
