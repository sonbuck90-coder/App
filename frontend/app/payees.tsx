import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { payeesApi, Payee } from '../src/services/api';
import { lookupBank, formatSortCode, isValidSortCode } from '../src/services/bank-lookup';

const COLORS = { primary: '#DB0011', white: '#FFFFFF', lightGray: '#F5F5F5', gray: '#767676', darkGray: '#333333', black: '#000000', success: '#00847F', background: '#F5F5F5' };

export default function PayeesScreen() {
  const [payees, setPayees] = useState<Payee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPayee, setEditingPayee] = useState<Payee | null>(null);
  const [name, setName] = useState('');
  const [sortCode, setSortCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => { fetchPayees(); }, []);

  const fetchPayees = async () => {
    try {
      const res = await payeesApi.getRecent();
      setPayees(res.data);
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  };

  const openAddModal = () => {
    setEditingPayee(null);
    setName(''); setSortCode(''); setAccountNumber('');
    setShowModal(true);
  };

  const openEditModal = (payee: Payee) => {
    setEditingPayee(payee);
    setName(payee.name);
    setSortCode(payee.sort_code);
    setAccountNumber(payee.account_number);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Error', 'Name is required'); return; }
    if (!sortCode || !isValidSortCode(sortCode)) { Alert.alert('Error', 'Valid sort code is required (XX-XX-XX)'); return; }
    if (!accountNumber.trim()) { Alert.alert('Error', 'Account number is required'); return; }

    setIsSaving(true);
    try {
      if (editingPayee) {
        await payeesApi.update(editingPayee.id, { name, sort_code: sortCode, account_number: accountNumber });
        Alert.alert('Updated', 'Payee updated successfully');
      } else {
        await payeesApi.create({ name, sort_code: sortCode, account_number: accountNumber });
        Alert.alert('Added', 'New payee added successfully');
      }
      setShowModal(false);
      fetchPayees();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to save payee');
    } finally { setIsSaving(false); }
  };

  const handleDelete = (payee: Payee) => {
    Alert.alert('Delete Payee', `Remove ${payee.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await payeesApi.delete(payee.id);
          fetchPayees();
        } catch (e) { Alert.alert('Error', 'Failed to delete'); }
      }},
    ]);
  };

  const getInitials = (n: string) => n.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  const getBankName = (sc: string) => {
    if (!sc) return null;
    const result = lookupBank(sc.replace(/-/g, ''));
    return result.found ? result.bank?.shortName : null;
  };

  if (isLoading) return <SafeAreaView style={styles.loading}><ActivityIndicator size="large" color={COLORS.primary} /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Manage Payees</Text>
      </View>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Add Button */}
        <TouchableOpacity style={styles.addButton} onPress={openAddModal} testID="add-payee-btn">
          <Ionicons name="add-circle" size={22} color={COLORS.primary} />
          <Text style={styles.addButtonText}>Add New Payee</Text>
        </TouchableOpacity>

        {payees.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color={COLORS.gray} />
            <Text style={styles.emptyText}>No saved payees yet</Text>
            <Text style={styles.emptySubtext}>Add payees to quickly transfer money</Text>
          </View>
        ) : (
          payees.map((payee) => (
            <View key={payee.id} style={styles.payeeCard} testID={`payee-card-${payee.id}`}>
              <View style={styles.payeeRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{getInitials(payee.name)}</Text>
                </View>
                <View style={styles.payeeDetails}>
                  <Text style={styles.payeeName}>{payee.name}</Text>
                  <Text style={styles.payeeSortCode}>{payee.sort_code} {getBankName(payee.sort_code) ? `· ${getBankName(payee.sort_code)}` : ''}</Text>
                  <Text style={styles.payeeAccountNum}>****{payee.account_number.slice(-4)}</Text>
                </View>
                <View style={styles.payeeActions}>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => openEditModal(payee)} testID={`edit-payee-${payee.id}`}>
                    <Ionicons name="create-outline" size={20} color={COLORS.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(payee)} testID={`delete-payee-${payee.id}`}>
                    <Ionicons name="trash-outline" size={20} color={COLORS.primary} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingPayee ? 'Edit Payee' : 'Add Payee'}</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}><Ionicons name="close" size={24} color={COLORS.darkGray} /></TouchableOpacity>
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Name</Text>
              <TextInput style={styles.input} placeholder="Payee name" placeholderTextColor={COLORS.gray} value={name} onChangeText={setName} testID="payee-name-input" />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Sort Code</Text>
              <TextInput style={styles.input} placeholder="XX-XX-XX" placeholderTextColor={COLORS.gray} value={sortCode} onChangeText={(t) => setSortCode(formatSortCode(t))} keyboardType="numeric" maxLength={8} testID="payee-sortcode-input" />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Account Number</Text>
              <TextInput style={styles.input} placeholder="Account number" placeholderTextColor={COLORS.gray} value={accountNumber} onChangeText={setAccountNumber} keyboardType="numeric" testID="payee-account-input" />
            </View>
            <TouchableOpacity style={[styles.saveButton, isSaving && { opacity: 0.7 }]} onPress={handleSave} disabled={isSaving} testID="save-payee-btn">
              {isSaving ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.saveButtonText}>{editingPayee ? 'Update Payee' : 'Add Payee'}</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loading: { flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' },
  header: { backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 16 },
  headerTitle: { fontSize: 20, fontWeight: '600', color: COLORS.white },
  scrollView: { flex: 1 },
  addButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.white, margin: 16, padding: 16, borderRadius: 8, borderWidth: 1, borderColor: COLORS.primary, borderStyle: 'dashed' },
  addButtonText: { fontSize: 16, fontWeight: '600', color: COLORS.primary, marginLeft: 8 },
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { fontSize: 18, fontWeight: '600', color: COLORS.darkGray, marginTop: 16 },
  emptySubtext: { fontSize: 14, color: COLORS.gray, marginTop: 4 },
  payeeCard: { backgroundColor: COLORS.white, marginHorizontal: 16, marginBottom: 12, borderRadius: 8, padding: 16 },
  payeeRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText: { fontSize: 16, fontWeight: '700', color: COLORS.white },
  payeeDetails: { flex: 1 },
  payeeName: { fontSize: 16, fontWeight: '600', color: COLORS.darkGray },
  payeeSortCode: { fontSize: 13, color: COLORS.success, marginTop: 2 },
  payeeAccountNum: { fontSize: 13, color: COLORS.gray, marginTop: 1 },
  payeeActions: { flexDirection: 'row' },
  actionBtn: { padding: 8, marginLeft: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: COLORS.darkGray },
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 13, color: COLORS.gray, marginBottom: 8 },
  input: { backgroundColor: COLORS.lightGray, borderRadius: 4, paddingHorizontal: 16, height: 52, fontSize: 15, color: COLORS.black, borderWidth: 1, borderColor: '#E0E0E0' },
  saveButton: { backgroundColor: COLORS.primary, borderRadius: 4, height: 52, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  saveButtonText: { color: COLORS.white, fontSize: 16, fontWeight: '600' },
});
