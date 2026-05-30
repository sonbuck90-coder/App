/**
 * Incoming Transfer — record a Faster Payment credit coming INTO one of your
 * accounts from an external sender (their name, sort code, account number).
 *
 * This screen mirrors the outgoing transfer flow: sender details + amount,
 * then a review page, then a styled "received" receipt with TRN / FPID.
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api, accountsApi, Account } from '../src/services/api';
import { useCustomization } from '../src/context/CustomizationContext';
import { lookupBank, formatSortCode, isValidSortCode } from '../src/services/bank-lookup';
import BackButton from '../src/components/BackButton';

const fmt = (v: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(v);

export default function IncomingTransferScreen() {
  const router = useRouter();
  const { colors: cc, headerTextColor } = useCustomization();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [acct, setAcct] = useState<Account | null>(null);
  const [name, setName] = useState('');
  const [sortCode, setSortCode] = useState('');
  const [accountNo, setAccountNo] = useState('');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');

  const [showReview, setShowReview] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receipt, setReceipt] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    accountsApi
      .getAll()
      .then((r) => {
        setAccounts(r.data);
        if (r.data.length > 0) setAcct(r.data[0]);
      })
      .finally(() => setLoading(false));
  }, []);

  const bank = sortCode.replace(/\D/g, '').length === 6 ? lookupBank(sortCode.replace(/\D/g, '')) : null;

  const openReview = () => {
    if (!acct) return Alert.alert('Pick an account', 'Choose which account to receive the funds into.');
    if (!name.trim()) return Alert.alert('Sender name required', 'Please enter the name of the person sending the money.');
    if (!isValidSortCode(sortCode)) return Alert.alert('Sort code', 'Sender sort code must be 6 digits.');
    if (accountNo.replace(/\D/g, '').length < 8) return Alert.alert('Account number', "Sender's account number should be 8 digits.");
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return Alert.alert('Amount', 'Enter a valid amount.');
    setShowReview(true);
  };

  const confirm = async () => {
    if (!acct || isProcessing) return;
    const amt = parseFloat(amount);
    setIsProcessing(true);
    setProgress(0);
    const interval = setInterval(() => setProgress((p) => Math.min(p + 20, 100)), 600);
    try {
      const [, res] = await Promise.all([
        new Promise((r) => setTimeout(r, 2400)),
        api.post('/deposits', {
          account_id: acct.id,
          amount: amt,
          source: name,
          sender_name: name,
          sender_sort_code: sortCode,
          sender_account_number: accountNo,
          reference: reference || `INC${Math.floor(Math.random() * 1e6).toString().padStart(6, '0')}`,
          description: `Incoming transfer from ${name}`,
        }),
      ]);
      setReceipt({
        amount: amt,
        sender: name,
        sortCode,
        accountNo,
        reference: reference || (res.data?.transaction_id || '').slice(0, 12).toUpperCase(),
        bankName: bank?.bankName,
        toAccount: `${acct.account_type === 'checking' ? 'Current' : 'Savings'} ****${acct.account_number.slice(-4)}`,
        newBalance: res.data?.new_balance,
        date: new Date().toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'short' }),
      });
      setShowReview(false);
      setShowReceipt(true);
    } catch (e: any) {
      Alert.alert('Could not record transfer', e?.response?.data?.detail || 'Try again');
    } finally {
      clearInterval(interval);
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const reset = () => {
    setName(''); setSortCode(''); setAccountNo(''); setAmount(''); setReference('');
    setShowReview(false); setShowReceipt(false); setReceipt(null);
  };

  if (loading) return <SafeAreaView style={s.center}><ActivityIndicator color={cc.primary} size="large" /></SafeAreaView>;

  // ------------------------ RECEIPT --------------------------
  if (showReceipt && receipt) {
    return (
      <SafeAreaView style={s.root} edges={['top']}>
        <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: 60 }}>
          <View style={[s.successCircle, { backgroundColor: '#00847F' }]}>
            <Ionicons name="arrow-down" size={40} color="#fff" />
          </View>
          <Text style={s.receiptHeading}>Money Received</Text>
          <Text style={[s.receiptAmount, { color: '#00847F' }]}>+{fmt(receipt.amount)}</Text>
          <Text style={s.receiptSub}>{receipt.date}</Text>

          <View style={s.detailsCard}>
            <View style={s.row}><Text style={s.k}>From</Text><Text style={s.v}>{receipt.sender}</Text></View>
            <View style={s.row}><Text style={s.k}>Sort code</Text><Text style={s.v}>{receipt.sortCode}</Text></View>
            <View style={s.row}><Text style={s.k}>Account number</Text><Text style={s.v}>{receipt.accountNo}</Text></View>
            {receipt.bankName && <View style={s.row}><Text style={s.k}>Bank</Text><Text style={s.v}>{receipt.bankName}</Text></View>}
            <View style={s.row}><Text style={s.k}>Received into</Text><Text style={s.v}>{receipt.toAccount}</Text></View>
            <View style={s.row}><Text style={s.k}>Reference</Text><Text style={s.v}>{receipt.reference}</Text></View>
            {receipt.newBalance !== undefined && <View style={s.row}><Text style={s.k}>New balance</Text><Text style={[s.v, { color: '#0B1424', fontSize: 16 }]}>{fmt(receipt.newBalance)}</Text></View>}
            <View style={[s.row, { borderBottomWidth: 0 }]}><Text style={s.k}>Status</Text><Text style={[s.v, { color: '#00847F' }]}>Completed</Text></View>
          </View>

          <TouchableOpacity style={[s.primaryBtn, { backgroundColor: cc.primary }]} onPress={() => router.replace('/(tabs)/home' as any)}>
            <Text style={s.primaryBtnText}>Back to home</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.secondaryBtn} onPress={reset}>
            <Text style={[s.secondaryBtnText, { color: cc.primary }]}>Record another incoming transfer</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ------------------------ REVIEW --------------------------
  if (showReview) {
    return (
      <SafeAreaView style={s.root} edges={['top']}>
        <View style={[s.header, { backgroundColor: cc.header }]}>
          <TouchableOpacity onPress={() => !isProcessing && setShowReview(false)} disabled={isProcessing} style={{ width: 32 }}>
            <Ionicons name="chevron-back" size={26} color={headerTextColor} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: headerTextColor }]}>Review incoming transfer</Text>
          <View style={{ width: 32 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 22 }}>
          <Text style={s.lead}>Confirm the sender details before recording this credit.</Text>

          <View style={s.detailsCard}>
            <Text style={s.cardLabel}>AMOUNT IN</Text>
            <Text style={[s.bigAmt, { color: '#00847F' }]}>+{fmt(parseFloat(amount || '0'))}</Text>
          </View>

          <View style={s.detailsCard}>
            <Text style={s.cardLabel}>FROM</Text>
            <View style={s.row}><Text style={s.k}>Sender</Text><Text style={s.v}>{name}</Text></View>
            <View style={s.row}><Text style={s.k}>Sort code</Text><Text style={s.v}>{sortCode}</Text></View>
            <View style={s.row}><Text style={s.k}>Account</Text><Text style={s.v}>{accountNo}</Text></View>
            {bank?.bankName && <View style={s.row}><Text style={s.k}>Bank</Text><Text style={s.v}>{bank.bankName}</Text></View>}
            {!!reference && <View style={[s.row, { borderBottomWidth: 0 }]}><Text style={s.k}>Reference</Text><Text style={s.v}>{reference}</Text></View>}
          </View>

          <View style={s.detailsCard}>
            <Text style={s.cardLabel}>RECEIVED INTO</Text>
            <View style={[s.row, { borderBottomWidth: 0 }]}><Text style={s.k}>Account</Text><Text style={s.v}>{acct ? `${acct.account_type === 'checking' ? 'Current' : 'Savings'} ****${acct.account_number.slice(-4)}` : '—'}</Text></View>
          </View>
        </ScrollView>

        <View style={s.footer}>
          <TouchableOpacity
            style={[s.primaryBtn, { backgroundColor: cc.primary }, isProcessing && { opacity: 0.6 }]}
            onPress={confirm}
            disabled={isProcessing}
            testID="incoming-confirm-btn"
          >
            {isProcessing ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={[s.primaryBtnText, { marginLeft: 8 }]}>Processing… {progress}%</Text>
              </View>
            ) : (
              <Text style={s.primaryBtnText}>Confirm &amp; Receive</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={s.secondaryBtn} onPress={() => !isProcessing && setShowReview(false)} disabled={isProcessing}>
            <Text style={[s.secondaryBtnText, { color: '#5E6A7A' }]}>Edit details</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ------------------------ FORM --------------------------
  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={[s.header, { backgroundColor: cc.header }]}>
        <BackButton color={headerTextColor} />
        <Text style={[s.headerTitle, { color: headerTextColor }]}>Incoming transfer</Text>
        <View style={{ width: 32 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          <Text style={s.lead}>Record a Faster Payment coming into your account. Enter the sender&apos;s details just like they appear on their banking app.</Text>

          {/* Receive into */}
          <Text style={s.fieldLabel}>Receive into</Text>
          <View style={s.acctRow}>
            {accounts.map((a) => {
              const active = acct?.id === a.id;
              return (
                <TouchableOpacity key={a.id} style={[s.acctChip, active && { borderColor: cc.primary, borderWidth: 2 }]} onPress={() => setAcct(a)}>
                  <Text style={s.acctChipName}>{a.account_type === 'checking' ? 'Current' : 'Savings'}</Text>
                  <Text style={s.acctChipMeta}>****{a.account_number.slice(-4)}</Text>
                  <Text style={s.acctChipBal}>{fmt(a.balance)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Sender details */}
          <Text style={s.section}>SENDER DETAILS</Text>
          <Text style={s.fieldLabel}>Sender&apos;s name</Text>
          <TextInput style={s.input} placeholder="e.g. Jane Smith" placeholderTextColor="#9AA3AF" value={name} onChangeText={setName} testID="sender-name-input" />

          <Text style={s.fieldLabel}>Sender&apos;s sort code</Text>
          <TextInput
            style={s.input}
            placeholder="40-47-84"
            placeholderTextColor="#9AA3AF"
            value={sortCode}
            keyboardType="numeric"
            maxLength={8}
            onChangeText={(t) => setSortCode(formatSortCode(t))}
            testID="sender-sortcode-input"
          />
          {bank?.bankName && (
            <View style={[s.bankBanner, { backgroundColor: '#E8F5F2' }]}>
              <Ionicons name="business" size={16} color="#0B5C56" />
              <Text style={s.bankBannerText}>{bank.bankName}</Text>
            </View>
          )}

          <Text style={s.fieldLabel}>Sender&apos;s account number</Text>
          <TextInput
            style={s.input}
            placeholder="12345678"
            placeholderTextColor="#9AA3AF"
            value={accountNo}
            keyboardType="numeric"
            maxLength={8}
            onChangeText={(t) => setAccountNo(t.replace(/\D/g, '').slice(0, 8))}
            testID="sender-account-input"
          />

          {/* Amount */}
          <Text style={s.section}>AMOUNT</Text>
          <View style={s.amountWrap}>
            <Text style={s.poundSign}>£</Text>
            <TextInput
              style={s.amountInput}
              placeholder="0.00"
              placeholderTextColor="#9AA3AF"
              value={amount}
              keyboardType="decimal-pad"
              onChangeText={setAmount}
              testID="incoming-amount-input"
            />
          </View>

          <Text style={s.fieldLabel}>Reference (optional)</Text>
          <TextInput
            style={s.input}
            placeholder="e.g. Birthday gift"
            placeholderTextColor="#9AA3AF"
            value={reference}
            onChangeText={setReference}
            maxLength={32}
            testID="incoming-reference-input"
          />

          <TouchableOpacity
            style={[s.primaryBtn, { backgroundColor: cc.primary, marginTop: 18 }]}
            onPress={openReview}
            testID="incoming-review-btn"
          >
            <Text style={s.primaryBtnText}>Review &amp; Receive</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F6F8' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F6F8' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 14 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  lead: { fontSize: 13, color: '#5E6A7A', lineHeight: 19, marginBottom: 18 },
  section: { fontSize: 11, fontWeight: '800', color: '#8893A3', letterSpacing: 0.8, marginTop: 18, marginBottom: 8 },
  fieldLabel: { fontSize: 12, color: '#5E6A7A', marginTop: 10, marginBottom: 6, fontWeight: '600' },
  input: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E8EC', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#0B1424' },
  bankBanner: { flexDirection: 'row', alignItems: 'center', padding: 8, borderRadius: 6, marginTop: 6 },
  bankBannerText: { fontSize: 12, color: '#0B5C56', fontWeight: '600', marginLeft: 6 },
  acctRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  acctChip: { flex: 1, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E8EC', borderRadius: 10, padding: 12 },
  acctChipName: { fontSize: 12, fontWeight: '700', color: '#0B1424' },
  acctChipMeta: { fontSize: 11, color: '#8893A3', marginTop: 2 },
  acctChipBal: { fontSize: 13, fontWeight: '700', color: '#0B1424', marginTop: 8 },
  amountWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E5E8EC', paddingHorizontal: 14 },
  poundSign: { fontSize: 26, fontWeight: '700', color: '#5E6A7A', marginRight: 6 },
  amountInput: { flex: 1, fontSize: 26, fontWeight: '700', paddingVertical: 14, color: '#0B1424' },
  detailsCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 18, marginBottom: 14 },
  cardLabel: { fontSize: 11, fontWeight: '800', color: '#8893A3', letterSpacing: 0.8, marginBottom: 8 },
  bigAmt: { fontSize: 32, fontWeight: '800', letterSpacing: -0.5 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#F0F2F5' },
  k: { fontSize: 13, color: '#5E6A7A' },
  v: { fontSize: 14, fontWeight: '600', color: '#0B1424', maxWidth: '60%', textAlign: 'right' },
  footer: { padding: 18, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#EFF1F4' },
  primaryBtn: { borderRadius: 10, paddingVertical: 15, alignItems: 'center' },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  secondaryBtn: { alignItems: 'center', paddingVertical: 12, marginTop: 6 },
  secondaryBtnText: { fontSize: 14, fontWeight: '600' },
  successCircle: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginTop: 16 },
  receiptHeading: { fontSize: 22, fontWeight: '700', color: '#0B1424', textAlign: 'center', marginTop: 16 },
  receiptAmount: { fontSize: 38, fontWeight: '800', textAlign: 'center', marginTop: 6 },
  receiptSub: { fontSize: 12, color: '#8893A3', textAlign: 'center', marginBottom: 22 },
});
