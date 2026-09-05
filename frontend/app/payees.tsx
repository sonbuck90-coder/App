import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { payeesApi, Payee } from '../src/services/api';
import { lookupBank, formatSortCode, isValidSortCode } from '../src/services/bank-lookup';
import BackButton from '../src/components/BackButton';
import { useCustomization } from '../src/context/CustomizationContext';

const COLORS = { primary: '#DB0011', white: '#FFFFFF', lightGray: '#F5F5F5', gray: '#767676', darkGray: '#333333', black: '#000000', success: '#00847F', background: '#F5F5F5' };

export default function PayeesScreen() {
  const router = useRouter();
  const { colors: cc } = useCustomization();
  const [payees, setPayees] = useState<Payee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPayee, setEditingPayee] = useState<Payee | null>(null);
  const [name, setName] = useState('');
  const [sortCode, setSortCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  // Long-press quick-action sheet
  const [actionPayee, setActionPayee] = useState<Payee | null>(null);

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
        <BackButton color={COLORS.white} />
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
            <TouchableOpacity
              key={payee.id}
              style={styles.payeeCard}
              onPress={() => setActionPayee(payee)}
              onLongPress={() => setActionPayee(payee)}
              delayLongPress={280}
              activeOpacity={0.75}
              testID={`payee-card-${payee.id}`}
            >
              <View style={styles.payeeRow}>
                <View style={[styles.avatar, { backgroundColor: cc.primary }]}>
                  <Text style={styles.avatarText}>{getInitials(payee.name)}</Text>
                </View>
                <View style={styles.payeeDetails}>
                  <Text style={styles.payeeName}>{payee.name}</Text>
                  <Text style={styles.payeeSortCode}>{payee.sort_code} {getBankName(payee.sort_code) ? `· ${getBankName(payee.sort_code)}` : ''}</Text>
                  <Text style={styles.payeeAccountNum}>****{payee.account_number.slice(-4)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={COLORS.gray} />
              </View>
              <Text style={styles.payeeHint}>Tap or long-press for quick actions</Text>
            </TouchableOpacity>
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Quick-action sheet — Send / Receive / Edit / Delete */}
      <Modal
        visible={!!actionPayee}
        transparent
        animationType="fade"
        onRequestClose={() => setActionPayee(null)}
      >
        <TouchableOpacity
          style={styles.actionOverlay}
          activeOpacity={1}
          onPress={() => setActionPayee(null)}
        >
          <TouchableOpacity style={styles.actionSheet} activeOpacity={1}>
            <View style={styles.actionHandle} />
            <View style={styles.actionHeader}>
              <View style={[styles.actionAvatar, { backgroundColor: cc.primary }]}>
                <Text style={styles.actionAvatarText}>
                  {actionPayee ? getInitials(actionPayee.name) : '?'}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionName}>{actionPayee?.name}</Text>
                <Text style={styles.actionMeta}>
                  {actionPayee?.sort_code} · ****{actionPayee?.account_number.slice(-4)}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => {
                if (!actionPayee) return;
                const p = actionPayee;
                setActionPayee(null);
                router.push({
                  pathname: '/(tabs)/transfers',
                  params: {
                    payee_name: p.name,
                    payee_sort: p.sort_code,
                    payee_account: p.account_number,
                  },
                });
              }}
              testID="payee-action-send"
            >
              <View style={[styles.actionIcon, { backgroundColor: cc.primary + '18' }]}>
                <Ionicons name="arrow-up" size={20} color={cc.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionItemLabel}>Send money</Text>
                <Text style={styles.actionItemSub}>Pre-fill a transfer to this payee</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.gray} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => {
                if (!actionPayee) return;
                const p = actionPayee;
                setActionPayee(null);
                router.push({
                  pathname: '/incoming-transfer',
                  params: {
                    sender_name: p.name,
                    sender_sort: p.sort_code,
                    sender_account: p.account_number,
                  },
                });
              }}
              testID="payee-action-receive"
            >
              <View style={[styles.actionIcon, { backgroundColor: COLORS.success + '18' }]}>
                <Ionicons name="arrow-down" size={20} color={COLORS.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionItemLabel}>Receive money</Text>
                <Text style={styles.actionItemSub}>Record incoming payment from this payee</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.gray} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => {
                if (!actionPayee) return;
                const p = actionPayee;
                setActionPayee(null);
                openEditModal(p);
              }}
              testID="payee-action-edit"
            >
              <View style={[styles.actionIcon, { backgroundColor: '#E7EEF7' }]}>
                <Ionicons name="create-outline" size={20} color="#1574EE" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionItemLabel}>Edit details</Text>
                <Text style={styles.actionItemSub}>Update name, sort code or account</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.gray} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => {
                if (!actionPayee) return;
                const p = actionPayee;
                setActionPayee(null);
                setTimeout(() => handleDelete(p), 60);
              }}
              testID="payee-action-delete"
            >
              <View style={[styles.actionIcon, { backgroundColor: '#FDECEC' }]}>
                <Ionicons name="trash-outline" size={20} color="#D9534F" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.actionItemLabel, { color: '#D9534F' }]}>Delete payee</Text>
                <Text style={styles.actionItemSub}>Remove from your saved list</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.gray} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCancel}
              onPress={() => setActionPayee(null)}
              testID="payee-action-cancel"
            >
              <Text style={styles.actionCancelText}>Cancel</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

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
  header: { backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 16, flexDirection: 'row', alignItems: 'center' },
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
  payeeHint: { fontSize: 11, color: COLORS.gray, marginTop: 8, marginLeft: 56 },

  // Quick-action sheet
  actionOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  actionSheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 34 : 22,
  },
  actionHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#D6DAE0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 14,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
  },
  actionAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  actionAvatarText: { color: COLORS.white, fontWeight: '800', fontSize: 17 },
  actionName: { fontSize: 16, fontWeight: '700', color: COLORS.darkGray },
  actionMeta: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  actionItemLabel: { fontSize: 15, fontWeight: '700', color: COLORS.darkGray },
  actionItemSub: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  actionCancel: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 8,
    borderRadius: 10,
    backgroundColor: '#F5F5F5',
  },
  actionCancelText: { fontSize: 15, fontWeight: '700', color: COLORS.darkGray },
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
