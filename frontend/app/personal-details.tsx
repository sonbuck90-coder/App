import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api, accountsApi, cardsApi, Account, Card } from '../src/services/api';
import { useCustomization } from '../src/context/CustomizationContext';
import { useAuth } from '../src/context/AuthContext';

const C = {
  white: '#FFFFFF',
  bg: '#F6F7F9',
  cardBg: '#FFFFFF',
  inputBg: '#EDF0F4',
  lightBorder: '#E8EBEE',
  divider: '#EEF0F3',
  gray: '#8893A3',
  midGray: '#5E6A7A',
  darkText: '#0B1424',
  black: '#000000',
  brandBlue: '#1574EE',
  success: '#00847F',
};

export default function PersonalDetailsScreen() {
  const router = useRouter();
  const { colors: cc } = useCustomization();
  const { refreshUser } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Profile fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  // Bank accounts + cards
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cards, setCards] = useState<Card[]>([]);

  // Track which field row is being edited (inline)
  const [editingField, setEditingField] = useState<string | null>(null);
  // Editable bank fields per account (keyed by account.id)
  const [acctEdits, setAcctEdits] = useState<Record<string, { sort_code: string; account_number: string }>>({});
  // Editable card fields per card.id
  const [cardEdits, setCardEdits] = useState<Record<string, { card_name: string; card_number: string; expiry_date: string }>>({});

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      const [profileRes, accountsRes, cardsRes] = await Promise.all([
        api.get('/profile'),
        accountsApi.getAll(),
        cardsApi.getAll(),
      ]);
      const p = profileRes.data;
      setName(p.name || '');
      setEmail(p.email || '');
      setPhone(p.phone || '');
      setAddress(p.address || '');
      setAccounts(accountsRes.data);
      setCards(cardsRes.data);

      // Seed edit maps
      const aMap: Record<string, any> = {};
      accountsRes.data.forEach((a) => {
        aMap[a.id] = { sort_code: a.sort_code || '', account_number: a.account_number || '' };
      });
      setAcctEdits(aMap);
      const cMap: Record<string, any> = {};
      cardsRes.data.forEach((c) => {
        cMap[c.id] = {
          card_name: c.card_name || '',
          card_number: c.card_number || '',
          expiry_date: c.expiry_date || '',
        };
      });
      setCardEdits(cMap);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCardNumber = (text: string) => text.replace(/\D/g, '').slice(0, 19).replace(/(.{4})/g, '$1 ').trim();
  const formatExpiry = (text: string) => {
    const d = text.replace(/\D/g, '').slice(0, 4);
    return d.length <= 2 ? d : `${d.slice(0, 2)}/${d.slice(2)}`;
  };

  const saveAll = useCallback(async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Full name is required');
      return;
    }
    setIsSaving(true);
    let savedAny = false;
    try {
      // 1. Profile
      await api.put('/profile', {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        address: address.trim(),
      });
      savedAny = true;

      // 2. Accounts (only changed)
      for (const acc of accounts) {
        const edit = acctEdits[acc.id];
        if (!edit) continue;
        if (
          (edit.sort_code && edit.sort_code !== acc.sort_code) ||
          (edit.account_number && edit.account_number !== acc.account_number)
        ) {
          await api.put('/accounts/details', {
            account_id: acc.id,
            sort_code: edit.sort_code,
            account_number: edit.account_number,
          });
          savedAny = true;
        }
      }

      // 3. Cards (only changed)
      for (const card of cards) {
        const edit = cardEdits[card.id];
        if (!edit) continue;
        const cleanNum = edit.card_number.replace(/\s/g, '');
        const changed =
          (edit.card_name && edit.card_name !== card.card_name) ||
          (cleanNum && cleanNum !== card.card_number) ||
          (edit.expiry_date && edit.expiry_date !== card.expiry_date);
        if (changed) {
          if (cleanNum && cleanNum.length < 12) {
            throw new Error('Card number must be at least 12 digits');
          }
          await cardsApi.update(card.id, {
            card_name: edit.card_name,
            card_number: cleanNum,
            expiry_date: edit.expiry_date,
          });
          savedAny = true;
        }
      }

      Alert.alert('Saved', savedAny ? 'Your details have been updated.' : 'No changes to save.');
      setEditingField(null);
      // Refresh the AuthContext user so the Home greeting + every other screen
      // that reads from useAuth() picks up the new name immediately.
      await refreshUser();
      load();
    } catch (e: any) {
      Alert.alert('Save Failed', e.response?.data?.detail || e.message || 'Could not save changes');
    } finally {
      setIsSaving(false);
    }
  }, [name, email, phone, address, accounts, cards, acctEdits, cardEdits]);

  if (isLoading) {
    return (
      <SafeAreaView style={s.loading} edges={['top']}>
        <ActivityIndicator size="large" color={cc.primary} />
      </SafeAreaView>
    );
  }

  const initials = (name || 'O').trim().split(/\s+/).map((n) => n[0]).slice(0, 2).join('').toUpperCase();

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      {/* Top brand bar */}
      <View style={s.brandBar}>
        <View style={s.brandLeft}>
          <View style={[s.brandLogo, { backgroundColor: cc.primary }]} />
          <Text style={s.brandText}>
            HSBC <Text style={s.brandTextLight}>UK</Text>
          </Text>
        </View>
        <View style={[s.brandLogoBox, { borderColor: cc.primary }]}>
          <View style={[s.brandLogoInner, { backgroundColor: cc.primary }]} />
        </View>
      </View>

      {/* Title row */}
      <View style={s.titleBar}>
        <TouchableOpacity onPress={() => router.back()} style={s.iconBtn} testID="back-btn" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={24} color={C.darkText} />
        </TouchableOpacity>
        <Text style={s.titleText}>Personal details</Text>
        <TouchableOpacity
          onPress={saveAll}
          disabled={isSaving}
          style={s.iconBtn}
          testID="save-profile-btn"
          accessibilityLabel="Save personal details"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          {isSaving ? (
            <ActivityIndicator color={C.brandBlue} />
          ) : (
            <Ionicons name="information-circle-outline" size={28} color={C.brandBlue} />
          )}
        </TouchableOpacity>
      </View>

      <View style={s.headerDivider} />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Profile Photo Card */}
          <View style={s.profileCard}>
            <View style={s.avatarRing}>
              <View style={s.avatarInner}>
                {initials ? (
                  <Text style={[s.avatarInitials, { color: cc.primary }]}>{initials}</Text>
                ) : (
                  <Ionicons name="person" size={48} color="#A4B0BE" />
                )}
              </View>
            </View>
            <View style={s.profileCardText}>
              <Text style={s.profileCardTitle}>Profile Photo</Text>
              <Text style={s.profileCardSubtitle}>Your profile picture</Text>
            </View>
          </View>

          {/* PERSONAL INFORMATION */}
          <Text style={s.sectionLabel}>PERSONAL INFORMATION</Text>
          <View style={s.detailsCard}>
            <DetailField
              label="Full Name"
              value={name}
              onChangeText={setName}
              fieldKey="name"
              editingField={editingField}
              setEditingField={setEditingField}
              isLast={false}
            />
            <DetailField
              label="Email Address"
              value={email}
              onChangeText={setEmail}
              fieldKey="email"
              editingField={editingField}
              setEditingField={setEditingField}
              keyboardType="email-address"
              autoCapitalize="none"
              isLast={false}
            />
            <DetailField
              label="Phone Number"
              value={phone}
              onChangeText={setPhone}
              fieldKey="phone"
              editingField={editingField}
              setEditingField={setEditingField}
              keyboardType="phone-pad"
              isLast={false}
            />
            <DetailField
              label="Address"
              value={address}
              onChangeText={setAddress}
              fieldKey="address"
              editingField={editingField}
              setEditingField={setEditingField}
              multiline
              isLast={true}
            />
          </View>

          {/* BANK DETAILS */}
          <Text style={s.sectionLabel}>BANK DETAILS</Text>
          {accounts.map((acc) => {
            const e = acctEdits[acc.id] || { sort_code: '', account_number: '' };
            const label = acc.account_type === 'checking' ? 'Current Account' : 'Savings Account';
            return (
              <View key={acc.id} style={s.detailsCard}>
                <View style={s.bankHeader}>
                  <View style={[s.bankDot, { backgroundColor: acc.account_type === 'checking' ? cc.primary : C.success }]} />
                  <Text style={s.bankTitle}>{label}</Text>
                </View>
                <View style={s.divider} />
                <DetailField
                  label="Sort Code"
                  value={e.sort_code}
                  onChangeText={(v) => setAcctEdits((p) => ({ ...p, [acc.id]: { ...p[acc.id], sort_code: v } }))}
                  fieldKey={`sort-${acc.id}`}
                  editingField={editingField}
                  setEditingField={setEditingField}
                  isLast={false}
                />
                <DetailField
                  label="Account Number"
                  value={e.account_number}
                  onChangeText={(v) => setAcctEdits((p) => ({ ...p, [acc.id]: { ...p[acc.id], account_number: v } }))}
                  fieldKey={`acc-${acc.id}`}
                  editingField={editingField}
                  setEditingField={setEditingField}
                  keyboardType="numeric"
                  isLast={true}
                />
              </View>
            );
          })}

          {/* CARD DETAILS */}
          {cards.length > 0 && (
            <>
              <Text style={s.sectionLabel}>CARD DETAILS</Text>
              {cards.map((card) => {
                const e = cardEdits[card.id] || { card_name: '', card_number: '', expiry_date: '' };
                const display = card.card_number_masked || '';
                return (
                  <View key={card.id} style={s.detailsCard}>
                    <View style={s.bankHeader}>
                      <Ionicons name="card" size={18} color={cc.primary} style={{ marginRight: 10 }} />
                      <Text style={s.bankTitle}>{card.card_type === 'credit' ? 'Credit Card' : 'Debit Card'}</Text>
                    </View>
                    <View style={s.divider} />
                    <DetailField
                      label="Cardholder Name"
                      value={e.card_name}
                      onChangeText={(v) => setCardEdits((p) => ({ ...p, [card.id]: { ...p[card.id], card_name: v.toUpperCase() } }))}
                      fieldKey={`cn-${card.id}`}
                      editingField={editingField}
                      setEditingField={setEditingField}
                      autoCapitalize="characters"
                      isLast={false}
                    />
                    <DetailField
                      label="Card Number"
                      value={editingField === `num-${card.id}` ? formatCardNumber(e.card_number) : (display || formatCardNumber(e.card_number))}
                      onChangeText={(v) => setCardEdits((p) => ({ ...p, [card.id]: { ...p[card.id], card_number: v.replace(/\s/g, '') } }))}
                      fieldKey={`num-${card.id}`}
                      editingField={editingField}
                      setEditingField={setEditingField}
                      keyboardType="numeric"
                      maxLength={23}
                      isLast={false}
                    />
                    <DetailField
                      label="Expiry Date"
                      value={editingField === `exp-${card.id}` ? formatExpiry(e.expiry_date) : e.expiry_date}
                      onChangeText={(v) => setCardEdits((p) => ({ ...p, [card.id]: { ...p[card.id], expiry_date: formatExpiry(v) } }))}
                      fieldKey={`exp-${card.id}`}
                      editingField={editingField}
                      setEditingField={setEditingField}
                      keyboardType="numeric"
                      maxLength={5}
                      isLast={true}
                    />
                  </View>
                );
              })}
            </>
          )}

          <View style={{ height: 50 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// =============== Inline-Editable Field Row ===============
interface DetailFieldProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  fieldKey: string;
  editingField: string | null;
  setEditingField: (k: string | null) => void;
  keyboardType?: any;
  autoCapitalize?: any;
  multiline?: boolean;
  isLast?: boolean;
  maxLength?: number;
}

function DetailField({
  label,
  value,
  onChangeText,
  fieldKey,
  editingField,
  setEditingField,
  keyboardType,
  autoCapitalize,
  multiline,
  isLast,
  maxLength,
}: DetailFieldProps) {
  const isEditing = editingField === fieldKey;
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => setEditingField(fieldKey)}
      style={[s.fieldRow, !isLast && s.fieldRowBorder]}
      testID={`field-${fieldKey}`}
    >
      <Text style={s.fieldLabel}>{label}</Text>
      {isEditing ? (
        <TextInput
          value={value}
          onChangeText={onChangeText}
          style={[s.fieldInput, multiline && s.fieldInputMulti]}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          multiline={multiline}
          autoFocus
          maxLength={maxLength}
          onBlur={() => setEditingField(null)}
          placeholder="Enter value"
          placeholderTextColor={C.gray}
        />
      ) : (
        <Text style={[s.fieldValue, !value && s.fieldValueEmpty]} numberOfLines={multiline ? 3 : 1}>
          {value || 'Tap to add'}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  loading: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },

  // Brand bar
  brandBar: {
    backgroundColor: C.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  brandLeft: { flexDirection: 'row', alignItems: 'center' },
  brandLogo: { width: 24, height: 24, marginRight: 8 },
  brandText: { fontSize: 18, fontWeight: '700', color: C.darkText, letterSpacing: 0.3 },
  brandTextLight: { fontWeight: '500', color: C.darkText },
  brandLogoBox: {
    width: 32,
    height: 32,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLogoInner: { width: 18, height: 18 },

  // Title bar
  titleBar: {
    backgroundColor: C.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 16,
  },
  iconBtn: { padding: 4 },
  titleText: { fontSize: 22, fontWeight: '700', color: C.darkText, letterSpacing: -0.2 },
  headerDivider: { height: 1, backgroundColor: C.lightBorder },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 24 },

  // Profile photo card
  profileCard: {
    backgroundColor: '#EEF1F4',
    borderRadius: 14,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarRing: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 1,
    borderColor: '#D8DEE6',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.white,
  },
  avatarInner: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#E5EAF1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: { fontSize: 26, fontWeight: '700' },
  profileCardText: { marginLeft: 18, flex: 1 },
  profileCardTitle: { fontSize: 19, fontWeight: '700', color: C.darkText },
  profileCardSubtitle: { fontSize: 14, color: C.midGray, marginTop: 2 },

  // Section label
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8893A3',
    letterSpacing: 1.2,
    marginTop: 26,
    marginBottom: 10,
    marginLeft: 4,
  },

  // Details card
  detailsCard: {
    backgroundColor: C.cardBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.lightBorder,
    overflow: 'hidden',
  },
  fieldRow: { paddingHorizontal: 18, paddingVertical: 14 },
  fieldRowBorder: { borderBottomWidth: 1, borderBottomColor: C.divider },
  fieldLabel: { fontSize: 13, color: C.midGray, fontWeight: '400', marginBottom: 4 },
  fieldValue: { fontSize: 19, fontWeight: '700', color: C.darkText, letterSpacing: -0.2 },
  fieldValueEmpty: { color: C.gray, fontWeight: '500' },
  fieldInput: {
    fontSize: 19,
    fontWeight: '700',
    color: C.darkText,
    padding: 0,
    margin: 0,
    minHeight: 24,
  },
  fieldInputMulti: { minHeight: 50, textAlignVertical: 'top' },

  // Bank header inside card
  bankHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 14, paddingBottom: 10 },
  bankDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  bankTitle: { fontSize: 15, fontWeight: '700', color: C.darkText },
  divider: { height: 1, backgroundColor: C.divider },
});
