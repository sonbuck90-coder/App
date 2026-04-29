import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api, accountsApi, Account } from '../src/services/api';
import { useCustomization } from '../src/context/CustomizationContext';

const C = { white: '#FFFFFF', lightGray: '#F5F5F5', gray: '#767676', darkGray: '#333333', black: '#000000', success: '#00847F', bg: '#F5F5F5' };

export default function PersonalDetailsScreen() {
  const router = useRouter();
  const { colors: cc } = useCustomization();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editSortCode, setEditSortCode] = useState('');
  const [editAccountNumber, setEditAccountNumber] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const [profileRes, accountsRes] = await Promise.all([
        api.get('/profile'),
        accountsApi.getAll(),
      ]);
      const p = profileRes.data;
      setName(p.name || '');
      setPhone(p.phone || '');
      setAddress(p.address || '');
      setAccounts(accountsRes.data);
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  };

  const handleSaveProfile = async () => {
    if (!name.trim()) { Alert.alert('Error', 'Name is required'); return; }
    setIsSaving(true);
    try {
      await api.put('/profile', { name: name.trim(), phone: phone.trim(), address: address.trim() });
      Alert.alert('Saved', 'Personal details updated successfully');
    } catch (e: any) { Alert.alert('Error', e.response?.data?.detail || 'Failed to save'); }
    finally { setIsSaving(false); }
  };

  const startEditAccount = (acc: Account) => {
    setEditingAccountId(acc.id);
    setEditSortCode(acc.sort_code || '');
    setEditAccountNumber(acc.account_number || '');
  };

  const handleSaveAccountDetails = async () => {
    if (!editingAccountId) return;
    if (!editSortCode.trim() || !editAccountNumber.trim()) {
      Alert.alert('Error', 'Sort code and account number are required');
      return;
    }
    setIsSaving(true);
    try {
      await api.put('/accounts/details', {
        account_id: editingAccountId,
        sort_code: editSortCode.trim(),
        account_number: editAccountNumber.trim(),
      });
      Alert.alert('Saved', 'Account details updated');
      setEditingAccountId(null);
      load();
    } catch (e: any) { Alert.alert('Error', e.response?.data?.detail || 'Failed to save'); }
    finally { setIsSaving(false); }
  };

  if (isLoading) return <SafeAreaView style={s.loading}><ActivityIndicator size="large" color={cc.primary} /></SafeAreaView>;

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={[s.header, { backgroundColor: cc.primary }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} testID="back-btn">
          <Ionicons name="arrow-back" size={24} color={C.white} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Personal Details</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Personal Info */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Personal Information</Text>
            <View style={s.card}>
              <View style={s.field}>
                <Text style={s.label}>Full Name</Text>
                <TextInput style={s.input} value={name} onChangeText={setName} placeholder="Enter your name" placeholderTextColor={C.gray} testID="name-input" />
              </View>
              <View style={s.divider} />
              <View style={s.field}>
                <Text style={s.label}>Phone Number</Text>
                <TextInput style={s.input} value={phone} onChangeText={setPhone} placeholder="Enter phone number" placeholderTextColor={C.gray} keyboardType="phone-pad" testID="phone-input" />
              </View>
              <View style={s.divider} />
              <View style={s.field}>
                <Text style={s.label}>Address</Text>
                <TextInput style={[s.input, s.multilineInput]} value={address} onChangeText={setAddress} placeholder="Enter your address" placeholderTextColor={C.gray} multiline numberOfLines={3} testID="address-input" />
              </View>
            </View>
            <TouchableOpacity style={[s.saveBtn, { backgroundColor: cc.primary }, isSaving && { opacity: 0.7 }]} onPress={handleSaveProfile} disabled={isSaving} testID="save-profile-btn">
              {isSaving ? <ActivityIndicator color={C.white} /> : <Text style={s.saveBtnText}>Save Changes</Text>}
            </TouchableOpacity>
          </View>

          {/* Account Details */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Account Details</Text>
            {accounts.map((acc) => (
              <View key={acc.id} style={s.card}>
                <View style={s.accHeader}>
                  <View style={s.accHeaderLeft}>
                    <View style={[s.accDot, { backgroundColor: acc.account_type === 'checking' ? cc.primary : C.success }]} />
                    <Text style={s.accTitle}>{acc.account_type === 'checking' ? 'Current Account' : 'Savings Account'}</Text>
                  </View>
                  {editingAccountId !== acc.id && (
                    <TouchableOpacity onPress={() => startEditAccount(acc)} testID={`edit-account-${acc.account_type}`}>
                      <Ionicons name="create-outline" size={20} color={cc.primary} />
                    </TouchableOpacity>
                  )}
                </View>

                {editingAccountId === acc.id ? (
                  /* Edit Mode */
                  <View style={s.editSection}>
                    <View style={s.field}>
                      <Text style={s.label}>Sort Code</Text>
                      <TextInput style={s.input} value={editSortCode} onChangeText={setEditSortCode} placeholder="XX-XX-XX" placeholderTextColor={C.gray} testID={`sort-code-edit-${acc.account_type}`} />
                    </View>
                    <View style={s.field}>
                      <Text style={s.label}>Account Number</Text>
                      <TextInput style={s.input} value={editAccountNumber} onChangeText={setEditAccountNumber} placeholder="12345678" placeholderTextColor={C.gray} keyboardType="numeric" testID={`acc-num-edit-${acc.account_type}`} />
                    </View>
                    <View style={s.editBtns}>
                      <TouchableOpacity style={s.cancelBtn} onPress={() => setEditingAccountId(null)}>
                        <Text style={s.cancelBtnText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[s.confirmBtn, { backgroundColor: cc.primary }]} onPress={handleSaveAccountDetails} disabled={isSaving} testID={`save-account-${acc.account_type}`}>
                        {isSaving ? <ActivityIndicator color={C.white} size="small" /> : <Text style={s.confirmBtnText}>Save</Text>}
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  /* Display Mode */
                  <View style={s.accDisplay}>
                    <View style={s.accRow}>
                      <Text style={s.accLabel}>Sort Code</Text>
                      <Text style={s.accValue}>{acc.sort_code || 'Not set'}</Text>
                    </View>
                    <View style={s.accRow}>
                      <Text style={s.accLabel}>Account Number</Text>
                      <Text style={s.accValue}>{acc.account_number || 'Not set'}</Text>
                    </View>
                  </View>
                )}
              </View>
            ))}
          </View>

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
  section: { marginHorizontal: 16, marginTop: 20 },
  sectionTitle: { fontSize: 17, fontWeight: '600', color: C.darkGray, marginBottom: 12 },
  card: { backgroundColor: C.white, borderRadius: 8, padding: 16, marginBottom: 12 },
  field: { marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', color: C.gray, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: C.lightGray, borderRadius: 6, paddingHorizontal: 14, height: 48, fontSize: 16, color: C.black, borderWidth: 1, borderColor: '#E0E0E0' },
  multilineInput: { height: 80, paddingTop: 12, textAlignVertical: 'top' },
  divider: { height: 1, backgroundColor: '#F0F0F0', marginBottom: 12 },
  saveBtn: { height: 48, borderRadius: 6, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  saveBtnText: { color: C.white, fontSize: 16, fontWeight: '600' },
  // Account details
  accHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  accHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
  accDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  accTitle: { fontSize: 16, fontWeight: '600', color: C.darkGray },
  accDisplay: { borderTopWidth: 1, borderTopColor: '#F0F0F0', paddingTop: 12 },
  accRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  accLabel: { fontSize: 14, color: C.gray },
  accValue: { fontSize: 16, fontWeight: '600', color: C.darkGray, letterSpacing: 0.5 },
  // Edit mode
  editSection: { borderTopWidth: 1, borderTopColor: '#F0F0F0', paddingTop: 12 },
  editBtns: { flexDirection: 'row', marginTop: 4, gap: 10 },
  cancelBtn: { flex: 1, height: 44, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: C.lightGray },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: C.darkGray },
  confirmBtn: { flex: 1, height: 44, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  confirmBtnText: { fontSize: 15, fontWeight: '600', color: C.white },
});
