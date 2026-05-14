import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator,
  Alert, Modal, KeyboardAvoidingView, Platform, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api, accountsApi, Account } from '../src/services/api';
import { useCustomization } from '../src/context/CustomizationContext';

const C = { white: '#FFFFFF', bg: '#F5F6F8', card: '#FFFFFF', border: '#E5E8EC', gray: '#8893A3', mid: '#5E6A7A', dark: '#0B1424', success: '#00847F', warn: '#E67E22' };

interface Currency { code: string; name: string; symbol: string; flag: string }

export default function InternationalTransferScreen() {
  const router = useRouter();
  const { colors: cc, headerTextColor } = useCustomization();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [fromAccountId, setFromAccountId] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [iban, setIban] = useState('');
  const [swift, setSwift] = useState('');
  const [country, setCountry] = useState('');
  const [purpose, setPurpose] = useState('');
  const [amount, setAmount] = useState('');
  const [sourceCcy, setSourceCcy] = useState('GBP');
  const [targetCcy, setTargetCcy] = useState('EUR');
  const [fxRate, setFxRate] = useState<number | null>(null);
  const [fxLoading, setFxLoading] = useState(false);
  const [isBusiness, setIsBusiness] = useState(false);
  const [invoice, setInvoice] = useState('');
  const [charges, setCharges] = useState<'SHA' | 'OUR' | 'BEN'>('SHA');
  const [picker, setPicker] = useState<null | 'source' | 'target'>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const [a, cRes] = await Promise.all([accountsApi.getAll(), api.get<Currency[]>('/fx/currencies')]);
      setAccounts(a.data);
      if (a.data.length) setFromAccountId(a.data[0].id);
      setCurrencies(cRes.data);
    })();
  }, []);

  // Refresh FX rate when currency pair changes
  useEffect(() => {
    refreshRate();
  }, [sourceCcy, targetCcy]);

  const refreshRate = async () => {
    setFxLoading(true);
    try {
      const r = await api.get(`/fx/rate?from_ccy=${sourceCcy}&to_ccy=${targetCcy}&amount=1`);
      setFxRate(r.data.rate);
    } catch {
      setFxRate(null);
    } finally {
      setFxLoading(false);
    }
  };

  const numericAmount = parseFloat(amount) || 0;
  const converted = useMemo(() => (fxRate ? +(numericAmount * fxRate).toFixed(2) : 0), [numericAmount, fxRate]);

  const findCcy = (code: string) => currencies.find((c) => c.code === code);
  const symbolOf = (code: string) => findCcy(code)?.symbol || code;

  const submit = async () => {
    if (!fromAccountId) { Alert.alert('Select account'); return; }
    if (!recipientName.trim()) { Alert.alert('Recipient name required'); return; }
    if (!iban.trim() || iban.length < 8) { Alert.alert('Valid IBAN required'); return; }
    if (!swift.trim() || swift.length < 8) { Alert.alert('SWIFT/BIC required (8 or 11 chars)'); return; }
    if (numericAmount <= 0) { Alert.alert('Amount must be greater than 0'); return; }
    setIsSubmitting(true);
    try {
      const res = await api.post('/transfers/international', {
        from_account_id: fromAccountId,
        amount: numericAmount,
        source_currency: sourceCcy,
        target_currency: targetCcy,
        recipient_name: recipientName.trim(),
        iban: iban.replace(/\s/g, '').toUpperCase(),
        swift_bic: swift.replace(/\s/g, '').toUpperCase(),
        recipient_country: country.trim(),
        purpose: purpose.trim(),
        charges_option: charges,
        is_business: isBusiness,
        invoice_number: isBusiness ? invoice.trim() : undefined,
      });
      Alert.alert(
        'Transfer Sent',
        `${symbolOf(sourceCcy)}${numericAmount.toFixed(2)} sent.\nRecipient receives ${symbolOf(targetCcy)}${res.data.amount_received.toFixed(2)} ${targetCcy}.\nTRN: ${res.data.trn}\nFPID: ${res.data.fpid}\nEstimated arrival: ${res.data.estimated_arrival}`,
        [{ text: 'OK', onPress: () => router.replace('/(tabs)/home') }]
      );
    } catch (e: any) {
      Alert.alert('Transfer Failed', e.response?.data?.detail || 'Could not complete');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={[s.header, { backgroundColor: cc.header }]}>
        <TouchableOpacity onPress={() => router.back()} testID="back-btn"><Ionicons name="arrow-back" size={24} color={headerTextColor} /></TouchableOpacity>
        <Text style={[s.headerTitle, { color: headerTextColor }]}>International Transfer</Text>
        <View style={{ width: 24 }} />
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">

          {/* Live FX rate */}
          <View style={s.fxCard}>
            <Text style={s.fxTitle}>Live Exchange Rate</Text>
            <View style={s.fxRow}>
              <TouchableOpacity style={s.ccyChip} onPress={() => setPicker('source')} testID="source-ccy-btn">
                <Text style={s.ccyFlag}>{findCcy(sourceCcy)?.flag || '💱'}</Text>
                <Text style={s.ccyCode}>{sourceCcy}</Text>
                <Ionicons name="chevron-down" size={16} color={C.gray} />
              </TouchableOpacity>
              <Ionicons name="arrow-forward" size={20} color={C.gray} />
              <TouchableOpacity style={s.ccyChip} onPress={() => setPicker('target')} testID="target-ccy-btn">
                <Text style={s.ccyFlag}>{findCcy(targetCcy)?.flag || '💱'}</Text>
                <Text style={s.ccyCode}>{targetCcy}</Text>
                <Ionicons name="chevron-down" size={16} color={C.gray} />
              </TouchableOpacity>
            </View>
            {fxLoading ? (
              <ActivityIndicator size="small" color={cc.primary} style={{ marginTop: 8 }} />
            ) : fxRate ? (
              <Text style={s.rateLine}>
                1 {sourceCcy} ≈ {fxRate} {targetCcy}
              </Text>
            ) : null}
            <TouchableOpacity onPress={refreshRate} style={s.refreshLink} testID="refresh-fx">
              <Ionicons name="refresh" size={14} color={cc.primary} />
              <Text style={[s.refreshText, { color: cc.primary }]}>Refresh rate</Text>
            </TouchableOpacity>
          </View>

          {/* From Account */}
          <Text style={s.sectionLabel}>FROM ACCOUNT</Text>
          <View style={s.card}>
            {accounts.map((acc) => (
              <TouchableOpacity key={acc.id} style={[s.acctRow, fromAccountId === acc.id && { backgroundColor: '#FFF0F0' }]} onPress={() => setFromAccountId(acc.id)}>
                <View style={[s.dot, { backgroundColor: acc.account_type === 'checking' ? cc.primary : C.success }]} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={s.acctTitle}>{acc.account_type === 'checking' ? 'Current Account' : 'Savings Account'}</Text>
                  <Text style={s.acctSub}>£{acc.balance.toFixed(2)} available</Text>
                </View>
                {fromAccountId === acc.id && <Ionicons name="checkmark-circle" size={20} color={cc.primary} />}
              </TouchableOpacity>
            ))}
          </View>

          {/* Amount */}
          <Text style={s.sectionLabel}>AMOUNT TO SEND</Text>
          <View style={s.card}>
            <View style={s.amountRow}>
              <Text style={[s.bigSymbol, { color: cc.primary }]}>{symbolOf(sourceCcy)}</Text>
              <TextInput
                value={amount}
                onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ''))}
                placeholder="0.00"
                placeholderTextColor={C.gray}
                style={s.bigAmount}
                keyboardType="decimal-pad"
                testID="amount-input"
              />
            </View>
            <Text style={s.convertedLine}>
              Recipient gets approx <Text style={{ color: C.dark, fontWeight: '700' }}>{symbolOf(targetCcy)}{converted.toFixed(2)}</Text> {targetCcy}
            </Text>
          </View>

          {/* Recipient */}
          <Text style={s.sectionLabel}>RECIPIENT DETAILS</Text>
          <View style={s.card}>
            <Row label="Full Name" value={recipientName} setter={setRecipientName} placeholder="Maria Garcia" testID="recipient-name" />
            <Row label="IBAN" value={iban} setter={(v) => setIban(v.toUpperCase())} placeholder="DE89 3704 0044 0532 0130 00" autoCap="characters" testID="iban-input" />
            <Row label="SWIFT / BIC" value={swift} setter={(v) => setSwift(v.toUpperCase())} placeholder="DEUTDEFFXXX" autoCap="characters" maxLen={11} testID="swift-input" />
            <Row label="Country" value={country} setter={setCountry} placeholder="Germany" testID="country-input" isLast />
          </View>

          {/* Purpose */}
          <Text style={s.sectionLabel}>PURPOSE OF TRANSFER</Text>
          <View style={s.card}>
            <TextInput value={purpose} onChangeText={setPurpose} placeholder="e.g. Family support" placeholderTextColor={C.gray} style={s.fieldInput} testID="purpose-input" />
          </View>

          {/* Charges */}
          <Text style={s.sectionLabel}>CHARGES</Text>
          <View style={[s.card, { flexDirection: 'row', gap: 8 }]}>
            {(['SHA', 'OUR', 'BEN'] as const).map((ch) => (
              <TouchableOpacity key={ch} style={[s.chargeChip, charges === ch && { backgroundColor: cc.primary }]} onPress={() => setCharges(ch)} testID={`charge-${ch}`}>
                <Text style={[s.chargeText, charges === ch && { color: '#FFF' }]}>{ch}</Text>
                <Text style={[s.chargeHint, charges === ch && { color: 'rgba(255,255,255,0.85)' }]}>
                  {ch === 'SHA' ? 'Shared' : ch === 'OUR' ? 'Sender pays' : 'Recipient pays'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Business mode */}
          <Text style={s.sectionLabel}>BUSINESS TRANSFER</Text>
          <View style={s.card}>
            <TouchableOpacity style={s.toggleRow} onPress={() => setIsBusiness(!isBusiness)} testID="business-toggle">
              <View>
                <Text style={s.toggleLabel}>Mark as business transaction</Text>
                <Text style={s.toggleHint}>Adds invoice number to receipt for VAT records</Text>
              </View>
              <View style={[s.toggle, isBusiness && { backgroundColor: cc.primary }]}>
                <View style={[s.toggleKnob, isBusiness && { transform: [{ translateX: 18 }] }]} />
              </View>
            </TouchableOpacity>
            {isBusiness && (
              <>
                <View style={s.divider} />
                <TextInput value={invoice} onChangeText={setInvoice} placeholder="Invoice number, e.g. INV-2024-001" placeholderTextColor={C.gray} style={s.fieldInput} testID="invoice-input" />
              </>
            )}
          </View>

          <TouchableOpacity style={[s.submitBtn, { backgroundColor: cc.primary }, isSubmitting && { opacity: 0.7 }]} onPress={submit} disabled={isSubmitting} testID="submit-international">
            {isSubmitting ? <ActivityIndicator color="#FFF" /> : (
              <>
                <Ionicons name="paper-plane" size={18} color="#FFF" />
                <Text style={s.submitText}>Send {symbolOf(sourceCcy)}{numericAmount.toFixed(2)}</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Currency Picker */}
      <Modal visible={picker !== null} transparent animationType="slide" onRequestClose={() => setPicker(null)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>Select {picker === 'source' ? 'source' : 'target'} currency</Text>
            <FlatList
              data={currencies}
              keyExtractor={(it) => it.code}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={s.ccyRow}
                  onPress={() => {
                    if (picker === 'source') setSourceCcy(item.code); else setTargetCcy(item.code);
                    setPicker(null);
                  }}
                  testID={`ccy-${item.code}`}
                >
                  <Text style={{ fontSize: 24, marginRight: 10 }}>{item.flag}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.ccyName}>{item.code} — {item.name}</Text>
                    <Text style={s.ccySym}>{item.symbol}</Text>
                  </View>
                </TouchableOpacity>
              )}
              style={{ maxHeight: 480 }}
            />
            <TouchableOpacity style={s.modalClose} onPress={() => setPicker(null)}>
              <Text style={{ color: cc.primary, fontWeight: '700' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

interface RowProps { label: string; value: string; setter: (v: string) => void; placeholder?: string; autoCap?: any; maxLen?: number; testID?: string; isLast?: boolean }
function Row({ label, value, setter, placeholder, autoCap, maxLen, testID, isLast }: RowProps) {
  return (
    <View style={[s.row, !isLast && s.rowBorder]}>
      <Text style={s.rowLabel}>{label}</Text>
      <TextInput value={value} onChangeText={setter} placeholder={placeholder} placeholderTextColor={C.gray} style={s.rowInput} autoCapitalize={autoCap} maxLength={maxLen} testID={testID} />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  content: { padding: 16, paddingBottom: 30 },
  fxCard: { backgroundColor: '#FFF', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.border },
  fxTitle: { fontSize: 12, fontWeight: '700', color: C.gray, letterSpacing: 1, marginBottom: 10 },
  fxRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  ccyChip: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, flex: 1, marginHorizontal: 4 },
  ccyFlag: { fontSize: 18, marginRight: 6 },
  ccyCode: { flex: 1, fontSize: 15, fontWeight: '700', color: C.dark },
  rateLine: { fontSize: 14, color: C.mid, marginTop: 8, fontWeight: '600' },
  refreshLink: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  refreshText: { fontSize: 12, fontWeight: '600', marginLeft: 4 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: C.gray, letterSpacing: 1.1, marginTop: 18, marginBottom: 8, marginLeft: 4 },
  card: { backgroundColor: '#FFF', borderRadius: 14, borderWidth: 1, borderColor: C.border, overflow: 'hidden', padding: 14 },
  acctRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  acctTitle: { fontSize: 15, fontWeight: '700', color: C.dark },
  acctSub: { fontSize: 12, color: C.gray, marginTop: 2 },
  amountRow: { flexDirection: 'row', alignItems: 'center' },
  bigSymbol: { fontSize: 28, fontWeight: '700', marginRight: 6 },
  bigAmount: { flex: 1, fontSize: 30, fontWeight: '700', color: C.dark, padding: 0 },
  convertedLine: { fontSize: 13, color: C.gray, marginTop: 6 },
  row: { paddingVertical: 8 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#EFF1F4' },
  rowLabel: { fontSize: 12, color: C.gray, marginBottom: 4 },
  rowInput: { fontSize: 16, fontWeight: '600', color: C.dark, padding: 0 },
  fieldInput: { fontSize: 15, color: C.dark, paddingVertical: 8 },
  chargeChip: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: C.border, alignItems: 'center' },
  chargeText: { fontSize: 14, fontWeight: '700', color: C.dark },
  chargeHint: { fontSize: 10, color: C.gray, marginTop: 2 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleLabel: { fontSize: 15, fontWeight: '600', color: C.dark },
  toggleHint: { fontSize: 11, color: C.gray, marginTop: 2 },
  toggle: { width: 44, height: 26, borderRadius: 13, backgroundColor: '#CCD3DA', padding: 3, justifyContent: 'center' },
  toggleKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFF' },
  divider: { height: 1, backgroundColor: '#EFF1F4', marginVertical: 8 },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 20, height: 52, borderRadius: 12 },
  submitText: { color: '#FFF', fontSize: 15, fontWeight: '700', marginLeft: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, paddingBottom: 24 },
  modalHandle: { width: 44, height: 4, backgroundColor: C.border, alignSelf: 'center', borderRadius: 2, marginBottom: 10 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: C.dark, marginBottom: 10 },
  ccyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F2F4F7' },
  ccyName: { fontSize: 15, fontWeight: '600', color: C.dark },
  ccySym: { fontSize: 12, color: C.gray, marginTop: 2 },
  modalClose: { alignItems: 'center', paddingVertical: 10, marginTop: 6 },
});
