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
import { getFooterTagline } from '../src/context/BankThemes';

const C = { white: '#FFFFFF', bg: '#F5F6F8', card: '#FFFFFF', border: '#E5E8EC', gray: '#8893A3', mid: '#5E6A7A', dark: '#0B1424', success: '#00847F', warn: '#E67E22' };

interface Currency { code: string; name: string; symbol: string; flag: string }

interface CountryPreset {
  code: string; // ISO-2
  name: string;
  flag: string;
  /** Which set of banking fields to collect. */
  scheme: 'iban' | 'us-ach' | 'canada';
  /** Default target currency when this country is picked. */
  defaultCcy: string;
  /** Placeholder shown for the primary IBAN/ACH field. */
  primaryPlaceholder: string;
  /** Optional dial code / display detail. */
  region?: string;
}

// Curated list of the most-used destinations for UK international transfers.
// Ordered by popularity + IBAN → non-IBAN grouping. All emoji flags.
const COUNTRY_PRESETS: CountryPreset[] = [
  // 🇺🇸 🇨🇦 non-IBAN corridors
  { code: 'US', name: 'United States', flag: '🇺🇸', scheme: 'us-ach', defaultCcy: 'USD', primaryPlaceholder: 'Routing 9 digits + Account', region: 'Americas' },
  { code: 'CA', name: 'Canada',         flag: '🇨🇦', scheme: 'canada', defaultCcy: 'CAD', primaryPlaceholder: 'Transit / Institution / Account', region: 'Americas' },
  // Eurozone / IBAN
  { code: 'DE', name: 'Germany',        flag: '🇩🇪', scheme: 'iban', defaultCcy: 'EUR', primaryPlaceholder: 'DE89 3704 0044 0532 0130 00' },
  { code: 'FR', name: 'France',         flag: '🇫🇷', scheme: 'iban', defaultCcy: 'EUR', primaryPlaceholder: 'FR14 2004 1010 0505 0001 3M02 606' },
  { code: 'ES', name: 'Spain',          flag: '🇪🇸', scheme: 'iban', defaultCcy: 'EUR', primaryPlaceholder: 'ES91 2100 0418 4502 0005 1332' },
  { code: 'IT', name: 'Italy',          flag: '🇮🇹', scheme: 'iban', defaultCcy: 'EUR', primaryPlaceholder: 'IT60 X054 2811 1010 0000 0123 456' },
  { code: 'NL', name: 'Netherlands',    flag: '🇳🇱', scheme: 'iban', defaultCcy: 'EUR', primaryPlaceholder: 'NL91 ABNA 0417 1643 00' },
  { code: 'IE', name: 'Ireland',        flag: '🇮🇪', scheme: 'iban', defaultCcy: 'EUR', primaryPlaceholder: 'IE29 AIBK 9311 5212 3456 78' },
  { code: 'PT', name: 'Portugal',       flag: '🇵🇹', scheme: 'iban', defaultCcy: 'EUR', primaryPlaceholder: 'PT50 0002 0123 1234 5678 9015 4' },
  { code: 'BE', name: 'Belgium',        flag: '🇧🇪', scheme: 'iban', defaultCcy: 'EUR', primaryPlaceholder: 'BE68 5390 0754 7034' },
  { code: 'AT', name: 'Austria',        flag: '🇦🇹', scheme: 'iban', defaultCcy: 'EUR', primaryPlaceholder: 'AT61 1904 3002 3457 3201' },
  { code: 'FI', name: 'Finland',        flag: '🇫🇮', scheme: 'iban', defaultCcy: 'EUR', primaryPlaceholder: 'FI21 1234 5600 0007 85' },
  { code: 'GR', name: 'Greece',         flag: '🇬🇷', scheme: 'iban', defaultCcy: 'EUR', primaryPlaceholder: 'GR16 0110 1250 0000 0001 2300 695' },
  // UK / other IBAN
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', scheme: 'iban', defaultCcy: 'GBP', primaryPlaceholder: 'GB29 HBUK 6016 1331 9268 19' },
  { code: 'CH', name: 'Switzerland',    flag: '🇨🇭', scheme: 'iban', defaultCcy: 'CHF', primaryPlaceholder: 'CH93 0076 2011 6238 5295 7' },
  { code: 'NO', name: 'Norway',         flag: '🇳🇴', scheme: 'iban', defaultCcy: 'NOK', primaryPlaceholder: 'NO93 8601 1117 947' },
  { code: 'SE', name: 'Sweden',         flag: '🇸🇪', scheme: 'iban', defaultCcy: 'SEK', primaryPlaceholder: 'SE45 5000 0000 0583 9825 7466' },
  { code: 'DK', name: 'Denmark',        flag: '🇩🇰', scheme: 'iban', defaultCcy: 'DKK', primaryPlaceholder: 'DK50 0040 0440 1162 43' },
  { code: 'PL', name: 'Poland',         flag: '🇵🇱', scheme: 'iban', defaultCcy: 'PLN', primaryPlaceholder: 'PL61 1090 1014 0000 0712 1981 2874' },
  { code: 'AU', name: 'Australia',      flag: '🇦🇺', scheme: 'iban', defaultCcy: 'AUD', primaryPlaceholder: 'BSB + Account (SWIFT format)' },
  { code: 'NZ', name: 'New Zealand',    flag: '🇳🇿', scheme: 'iban', defaultCcy: 'NZD', primaryPlaceholder: 'Bank–Branch–Account (SWIFT format)' },
  { code: 'IN', name: 'India',          flag: '🇮🇳', scheme: 'iban', defaultCcy: 'INR', primaryPlaceholder: 'IFSC + Account (SWIFT format)' },
  { code: 'AE', name: 'UAE',            flag: '🇦🇪', scheme: 'iban', defaultCcy: 'AED', primaryPlaceholder: 'AE07 0331 2345 6789 0123 456' },
  { code: 'ZA', name: 'South Africa',   flag: '🇿🇦', scheme: 'iban', defaultCcy: 'ZAR', primaryPlaceholder: 'Branch + Account (SWIFT format)' },
  { code: 'SG', name: 'Singapore',      flag: '🇸🇬', scheme: 'iban', defaultCcy: 'SGD', primaryPlaceholder: 'Bank + Branch + Account (SWIFT format)' },
  { code: 'HK', name: 'Hong Kong',      flag: '🇭🇰', scheme: 'iban', defaultCcy: 'HKD', primaryPlaceholder: 'Bank–Branch–Account (SWIFT format)' },
  { code: 'JP', name: 'Japan',          flag: '🇯🇵', scheme: 'iban', defaultCcy: 'JPY', primaryPlaceholder: 'Bank + Branch + Account (SWIFT format)' },
  { code: 'MX', name: 'Mexico',         flag: '🇲🇽', scheme: 'iban', defaultCcy: 'MXN', primaryPlaceholder: 'CLABE 18 digits' },
  { code: 'BR', name: 'Brazil',         flag: '🇧🇷', scheme: 'iban', defaultCcy: 'BRL', primaryPlaceholder: 'Agency + Account (SWIFT format)' },
];

export default function InternationalTransferScreen() {
  const router = useRouter();
  const { colors: cc, headerTextColor, bankThemeId } = useCustomization();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [fromAccountId, setFromAccountId] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [iban, setIban] = useState('');
  const [swift, setSwift] = useState('');
  const [country, setCountry] = useState<CountryPreset>(
    COUNTRY_PRESETS.find((c) => c.code === 'DE')!,
  );
  const [routingNumber, setRoutingNumber] = useState('');   // US ACH
  const [accountNumber, setAccountNumber] = useState('');   // US ACH / Canada
  const [transitNumber, setTransitNumber] = useState('');   // Canada 5-digit
  const [institutionNumber, setInstitutionNumber] = useState(''); // Canada 3-digit
  const [purpose, setPurpose] = useState('');
  const [amount, setAmount] = useState('');
  const [sourceCcy, setSourceCcy] = useState('GBP');
  const [targetCcy, setTargetCcy] = useState('EUR');
  const [fxRate, setFxRate] = useState<number | null>(null);
  const [fxLoading, setFxLoading] = useState(false);
  const [isBusiness, setIsBusiness] = useState(false);
  const [invoice, setInvoice] = useState('');
  const [charges, setCharges] = useState<'SHA' | 'OUR' | 'BEN'>('SHA');
  const [picker, setPicker] = useState<null | 'source' | 'target' | 'country'>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Inline receipt state — displayed instead of an Alert to avoid the
  // iOS/web modal-on-modal freeze that used to happen when Alert.alert
  // fired immediately after the AuthGate Modal dismissed.
  const [receipt, setReceipt] = useState<null | {
    amountSent: number;
    amountReceived: number;
    recipient: string;
    iban: string;
    trn: string;
    fpid: string;
    eta: string;
    invoice?: string;
  }>(null);

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
    // Scheme-specific field validation
    if (country.scheme === 'us-ach') {
      if (!/^\d{9}$/.test(routingNumber.replace(/\s|-/g, ''))) { Alert.alert('US routing number must be 9 digits'); return; }
      if (!accountNumber.trim() || accountNumber.length < 4) { Alert.alert('US account number required'); return; }
    } else if (country.scheme === 'canada') {
      if (!/^\d{5}$/.test(transitNumber.replace(/\s|-/g, ''))) { Alert.alert('Canada transit number must be 5 digits'); return; }
      if (!/^\d{3}$/.test(institutionNumber.replace(/\s|-/g, ''))) { Alert.alert('Canada institution number must be 3 digits'); return; }
      if (!accountNumber.trim() || accountNumber.length < 4) { Alert.alert('Canada account number required'); return; }
    } else {
      if (!iban.trim() || iban.length < 8) { Alert.alert('Valid IBAN required'); return; }
      if (!swift.trim() || swift.length < 8) { Alert.alert('SWIFT/BIC required (8 or 11 chars)'); return; }
    }
    if (numericAmount <= 0) { Alert.alert('Amount must be greater than 0'); return; }
    // Build a human-readable primary identifier for the auth prompt + receipt.
    let primaryIdent = '';
    if (country.scheme === 'us-ach') primaryIdent = `RTN ${routingNumber} / Acc ${accountNumber}`;
    else if (country.scheme === 'canada') primaryIdent = `${transitNumber}-${institutionNumber}-${accountNumber}`;
    else primaryIdent = iban.replace(/\s/g, '').toUpperCase();

    // No passcode / Face-ID gate on international transfers — the user
    // reported the AuthGate Modal was causing a freeze on submit. Domestic
    // transfers don't require an extra prompt either, so we keep the two
    // flows consistent. The transaction still needs a valid form and hits
    // the same offline adapter that generates the TRN + FPID receipt.
    setIsSubmitting(true);
    try {
      // Realistic UK-bank-style 2.4-second processing delay so the user
      // sees the "Verifying transaction…" progress and it doesn't feel
      // instant. Matches the domestic-transfer feel.
      await new Promise((r) => setTimeout(r, 2400));
      const res = await api.post('/transfers/international', {
        from_account_id: fromAccountId,
        amount: numericAmount,
        source_currency: sourceCcy,
        target_currency: targetCcy,
        recipient_name: recipientName.trim(),
        // For IBAN schemes send IBAN + SWIFT; for US/Canada synthesise a
        // pseudo-IBAN in the shape "<code>:<primaryIdent>" so the offline
        // adapter can still index the transaction consistently, and pass
        // the individual fields separately for future backend routing.
        iban: country.scheme === 'iban' ? iban.replace(/\s/g, '').toUpperCase() : `${country.code}:${primaryIdent}`,
        swift_bic: country.scheme === 'iban' ? swift.replace(/\s/g, '').toUpperCase() : undefined,
        routing_number: country.scheme === 'us-ach' ? routingNumber.replace(/\s|-/g, '') : undefined,
        account_number: (country.scheme === 'us-ach' || country.scheme === 'canada') ? accountNumber.trim() : undefined,
        transit_number: country.scheme === 'canada' ? transitNumber.replace(/\s|-/g, '') : undefined,
        institution_number: country.scheme === 'canada' ? institutionNumber.replace(/\s|-/g, '') : undefined,
        recipient_country: country.code,
        recipient_country_name: country.name,
        payment_scheme: country.scheme,
        purpose: purpose.trim(),
        charges_option: charges,
        is_business: isBusiness,
        invoice_number: isBusiness ? invoice.trim() : undefined,
      });
      // Inline success card avoids the modal-on-modal freeze that used to
      // happen when Alert.alert was called immediately after the AuthGate
      // Modal dismissed. TRN + FPID are preserved on the card so the user
      // still sees the full HSBC-style Faster-Payments identifiers.
      setReceipt({
        amountSent: numericAmount,
        amountReceived: res.data.amount_received,
        recipient: recipientName.trim(),
        iban: primaryIdent,
        trn: res.data.trn,
        fpid: res.data.fpid,
        eta: res.data.estimated_arrival,
        invoice: isBusiness && invoice.trim() ? invoice.trim() : undefined,
      });
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
        {receipt ? (
          <ScrollView contentContainerStyle={s.content}>
            <View style={s.rcpt} testID="intl-receipt">
              <View style={[s.rcptIcon, { backgroundColor: cc.primary + '15' }]}>
                <Ionicons name="checkmark-circle" size={54} color={cc.primary} />
              </View>
              <Text style={s.rcptTitle}>Transfer Sent</Text>
              <Text style={s.rcptAmount}>{symbolOf(sourceCcy)}{receipt.amountSent.toFixed(2)}</Text>
              <Text style={s.rcptSub}>Recipient receives {symbolOf(targetCcy)}{receipt.amountReceived.toFixed(2)} {targetCcy}</Text>
              <View style={s.rcptDivider} />
              <View style={s.rcptRow}><Text style={s.rcptLabel}>To</Text><Text style={s.rcptVal}>{receipt.recipient}</Text></View>
              <View style={s.rcptRow}><Text style={s.rcptLabel}>Country</Text><Text style={s.rcptVal}>{country.flag} {country.name}</Text></View>
              <View style={s.rcptRow}>
                <Text style={s.rcptLabel}>{country.scheme === 'iban' ? 'IBAN' : country.scheme === 'us-ach' ? 'Routing / Account' : 'Transit-Institution-Acc'}</Text>
                <Text style={[s.rcptVal, s.mono]}>{receipt.iban}</Text>
              </View>
              <View style={s.rcptRow}><Text style={s.rcptLabel}>TRN</Text><Text style={[s.rcptVal, s.mono]} testID="rcpt-trn">{receipt.trn}</Text></View>
              <View style={s.rcptRow}><Text style={s.rcptLabel}>FPID</Text><Text style={[s.rcptVal, s.mono]} testID="rcpt-fpid">{receipt.fpid}</Text></View>
              {receipt.invoice && (
                <View style={s.rcptRow}><Text style={s.rcptLabel}>Invoice</Text><Text style={s.rcptVal}>{receipt.invoice}</Text></View>
              )}
              <View style={s.rcptRow}><Text style={s.rcptLabel}>Estimated arrival</Text><Text style={s.rcptVal}>{receipt.eta}</Text></View>
              <TouchableOpacity
                style={[s.rcptBtn, { backgroundColor: cc.primary }]}
                onPress={() => { setReceipt(null); router.replace('/(tabs)/home' as any); }}
                testID="rcpt-done">
                <Text style={s.rcptBtnText}>Back to Home</Text>
              </TouchableOpacity>
              <Text style={s.rcptFooter}>{getFooterTagline(bankThemeId)}</Text>
            </View>
          </ScrollView>
        ) : (
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

          {/* Country picker — modern flag chip that opens a bottom sheet */}
          <Text style={s.sectionLabel}>DESTINATION COUNTRY</Text>
          <TouchableOpacity style={s.countryChipCard} onPress={() => setPicker('country')} testID="country-picker-btn">
            <Text style={s.countryFlag}>{country.flag}</Text>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.countryName}>{country.name}</Text>
              <Text style={s.countryScheme}>
                {country.scheme === 'iban'
                  ? 'SWIFT / IBAN payment'
                  : country.scheme === 'us-ach'
                    ? 'US ACH / SWIFT payment'
                    : 'Canadian domestic / SWIFT'}
                {'  ·  '}
                <Text style={{ fontWeight: '700' }}>{country.defaultCcy}</Text>
              </Text>
            </View>
            <Ionicons name="chevron-down" size={20} color={C.gray} />
          </TouchableOpacity>

          {/* Recipient */}
          <Text style={s.sectionLabel}>RECIPIENT DETAILS</Text>
          <View style={s.card}>
            <Row label="Full Name" value={recipientName} setter={setRecipientName} placeholder="Maria Garcia" testID="recipient-name" />
            {country.scheme === 'iban' && (
              <>
                <Row label="IBAN" value={iban} setter={(v) => setIban(v.toUpperCase())} placeholder={country.primaryPlaceholder} autoCap="characters" testID="iban-input" />
                <Row label="SWIFT / BIC" value={swift} setter={(v) => setSwift(v.toUpperCase())} placeholder="DEUTDEFFXXX" autoCap="characters" maxLen={11} testID="swift-input" isLast />
              </>
            )}
            {country.scheme === 'us-ach' && (
              <>
                <Row
                  label="Routing Number (ABA)"
                  value={routingNumber}
                  setter={(v) => setRoutingNumber(v.replace(/\D/g, '').slice(0, 9))}
                  placeholder="9 digits — e.g. 021000021"
                  keyboardType="numeric"
                  maxLen={9}
                  testID="routing-input"
                />
                <Row
                  label="Account Number"
                  value={accountNumber}
                  setter={(v) => setAccountNumber(v.replace(/\D/g, '').slice(0, 17))}
                  placeholder="Up to 17 digits"
                  keyboardType="numeric"
                  testID="us-account-input"
                  isLast
                />
              </>
            )}
            {country.scheme === 'canada' && (
              <>
                <Row
                  label="Transit Number"
                  value={transitNumber}
                  setter={(v) => setTransitNumber(v.replace(/\D/g, '').slice(0, 5))}
                  placeholder="5 digits — e.g. 00001"
                  keyboardType="numeric"
                  maxLen={5}
                  testID="transit-input"
                />
                <Row
                  label="Institution Number"
                  value={institutionNumber}
                  setter={(v) => setInstitutionNumber(v.replace(/\D/g, '').slice(0, 3))}
                  placeholder="3 digits — e.g. 001"
                  keyboardType="numeric"
                  maxLen={3}
                  testID="institution-input"
                />
                <Row
                  label="Account Number"
                  value={accountNumber}
                  setter={(v) => setAccountNumber(v.replace(/\D/g, '').slice(0, 12))}
                  placeholder="7–12 digits"
                  keyboardType="numeric"
                  testID="ca-account-input"
                  isLast
                />
              </>
            )}
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
            {isSubmitting ? (
              <>
                <ActivityIndicator color="#FFF" style={{ marginRight: 8 }} />
                <Text style={s.submitText}>Verifying transaction…</Text>
              </>
            ) : (
              <>
                <Ionicons name="paper-plane" size={18} color="#FFF" />
                <Text style={s.submitText}>Send {symbolOf(sourceCcy)}{numericAmount.toFixed(2)}</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
        )}
      </KeyboardAvoidingView>

      {/* Currency Picker */}
      <Modal visible={picker === 'source' || picker === 'target'} transparent animationType="slide" onRequestClose={() => setPicker(null)}>
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

      {/* Country Picker */}
      <Modal visible={picker === 'country'} transparent animationType="slide" onRequestClose={() => setPicker(null)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>Select destination country</Text>
            <FlatList
              data={COUNTRY_PRESETS}
              keyExtractor={(it) => it.code}
              renderItem={({ item }) => {
                const active = item.code === country.code;
                return (
                  <TouchableOpacity
                    style={[s.countryRow, active && { backgroundColor: cc.primary + '10' }]}
                    onPress={() => {
                      setCountry(item);
                      // Auto-align target currency with the chosen country.
                      setTargetCcy(item.defaultCcy);
                      // Clear scheme-specific fields to avoid leaking data.
                      setIban(''); setSwift(''); setRoutingNumber(''); setAccountNumber(''); setTransitNumber(''); setInstitutionNumber('');
                      setPicker(null);
                    }}
                    testID={`country-${item.code}`}
                  >
                    <Text style={{ fontSize: 28, marginRight: 12 }}>{item.flag}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.countryRowName}>{item.name}</Text>
                      <Text style={s.countryRowSub}>
                        {item.scheme === 'iban' ? 'IBAN / SWIFT' : item.scheme === 'us-ach' ? 'US ACH · Routing + Account' : 'Canadian domestic · Transit-Inst-Acc'}
                        {'  ·  '}{item.defaultCcy}
                      </Text>
                    </View>
                    {active && <Ionicons name="checkmark-circle" size={20} color={cc.primary} />}
                  </TouchableOpacity>
                );
              }}
              style={{ maxHeight: 520 }}
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

interface RowProps { label: string; value: string; setter: (v: string) => void; placeholder?: string; autoCap?: any; maxLen?: number; testID?: string; isLast?: boolean; keyboardType?: any }
function Row({ label, value, setter, placeholder, autoCap, maxLen, testID, isLast, keyboardType }: RowProps) {
  return (
    <View style={[s.row, !isLast && s.rowBorder]}>
      <Text style={s.rowLabel}>{label}</Text>
      <TextInput value={value} onChangeText={setter} placeholder={placeholder} placeholderTextColor={C.gray} style={s.rowInput} autoCapitalize={autoCap} maxLength={maxLen} keyboardType={keyboardType} testID={testID} />
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
  // Country picker card + rows
  countryChipCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: C.border, marginBottom: 6,
  },
  countryFlag: { fontSize: 36 },
  countryName: { fontSize: 16, fontWeight: '700', color: C.dark },
  countryScheme: { fontSize: 12, color: C.gray, marginTop: 2 },
  countryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10 },
  countryRowName: { fontSize: 15, fontWeight: '600', color: C.dark },
  countryRowSub: { fontSize: 12, color: C.gray, marginTop: 2 },
  // Inline receipt (post-submit success card)
  rcpt: { backgroundColor: C.card, borderRadius: 14, padding: 22, marginTop: 14, alignItems: 'center' },
  rcptIcon: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  rcptTitle: { fontSize: 20, fontWeight: '800', color: C.dark, marginTop: 4 },
  rcptAmount: { fontSize: 34, fontWeight: '800', color: C.dark, marginTop: 6 },
  rcptSub: { fontSize: 13, color: C.mid, marginTop: 4, textAlign: 'center' },
  rcptDivider: { height: 1, backgroundColor: '#EEF0F3', alignSelf: 'stretch', marginVertical: 16 },
  rcptRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', alignSelf: 'stretch', paddingVertical: 6 },
  rcptLabel: { fontSize: 13, color: C.gray },
  rcptVal: { fontSize: 13, fontWeight: '600', color: C.dark, maxWidth: '65%', textAlign: 'right' },
  mono: { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  rcptBtn: { marginTop: 20, alignSelf: 'stretch', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  rcptBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  rcptFooter: { fontSize: 11, color: C.gray, marginTop: 16, letterSpacing: 0.5 },
});
