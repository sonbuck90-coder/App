import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, Modal, KeyboardAvoidingView, Platform, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { accountsApi, schedulesApi, Account, Schedule } from '../src/services/api';
import { useCustomization } from '../src/context/CustomizationContext';

const C = { white: '#FFFFFF', lightGray: '#F5F5F5', gray: '#767676', darkGray: '#333333', black: '#000000', success: '#00847F', bg: '#F5F5F5', warning: '#E67E22' };

export default function SchedulesScreen() {
  const router = useRouter();
  const { colors: cc } = useCustomization();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selAccIdx, setSelAccIdx] = useState(0);
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<'weekly' | 'monthly'>('monthly');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => { load(); }, []);
  const load = async () => {
    try {
      const [aRes, sRes] = await Promise.all([accountsApi.getAll(), schedulesApi.getAll()]);
      setAccounts(aRes.data); setSchedules(sRes.data);
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); setRefreshing(false); }
  };
  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, []);

  const fmt = (v: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(v);
  const accLabel = (id: string) => { const a = accounts.find(x => x.id === id); return a ? (a.account_type === 'checking' ? 'Current' : 'Savings') : 'Account'; };
  const fmtDate = (d: string) => { try { return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return d; } };

  const handleCreate = async () => {
    const val = parseFloat(amount);
    if (!val || val <= 0) { Alert.alert('Error', 'Enter a valid amount'); return; }
    if (!accounts[selAccIdx]) return;

    setIsSaving(true);
    try {
      await schedulesApi.create({ account_id: accounts[selAccIdx].id, amount: val, frequency });
      setShowModal(false); setAmount('');
      Alert.alert('Scheduled!', `${fmt(val)} ${frequency} deposit set up`);
      load();
    } catch (e: any) { Alert.alert('Error', e.response?.data?.detail || 'Failed'); }
    finally { setIsSaving(false); }
  };

  const handleDelete = (sched: Schedule) => {
    Alert.alert('Cancel Schedule', `Remove ${fmt(sched.amount)} ${sched.frequency} deposit?`, [
      { text: 'Keep', style: 'cancel' },
      { text: 'Cancel', style: 'destructive', onPress: async () => { try { await schedulesApi.delete(sched.id); load(); } catch(e){} } },
    ]);
  };

  const handleToggle = async (sched: Schedule) => {
    try { await schedulesApi.toggle(sched.id); load(); } catch(e) { Alert.alert('Error', 'Failed to update'); }
  };

  if (isLoading) return <SafeAreaView style={s.loading}><ActivityIndicator size="large" color={cc.primary} /></SafeAreaView>;

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={[s.header, { backgroundColor: cc.header }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} testID="back-btn"><Ionicons name="arrow-back" size={24} color={C.white} /></TouchableOpacity>
        <Text style={s.headerTitle}>Scheduled Deposits</Text>
      </View>

      <ScrollView style={s.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={cc.primary} />} showsVerticalScrollIndicator={false}>
        {/* Add New Button */}
        <TouchableOpacity style={[s.addBtn, { borderColor: cc.primary }]} onPress={() => setShowModal(true)} testID="add-schedule-btn">
          <Ionicons name="add-circle" size={22} color={cc.primary} />
          <Text style={[s.addTxt, { color: cc.primary }]}>New Scheduled Deposit</Text>
        </TouchableOpacity>

        {/* Active Schedules */}
        {schedules.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="calendar-outline" size={56} color={C.gray} />
            <Text style={s.emptyTitle}>No Scheduled Deposits</Text>
            <Text style={s.emptySub}>Set up recurring deposits to grow your savings automatically</Text>
          </View>
        ) : (
          <>
            <Text style={s.listTitle}>Your Schedules</Text>
            {schedules.map((sched) => (
              <View key={sched.id} style={[s.schedCard, !sched.is_active && s.schedInactive]} testID={`schedule-${sched.id}`}>
                <View style={s.schedTop}>
                  <View style={[s.schedIcon, { backgroundColor: sched.is_active ? `${cc.primary}15` : C.lightGray }]}>
                    <Ionicons name={sched.frequency === 'weekly' ? 'calendar' : 'calendar-outline'} size={22} color={sched.is_active ? cc.primary : C.gray} />
                  </View>
                  <View style={s.schedInfo}>
                    <Text style={s.schedAmt}>{fmt(sched.amount)}</Text>
                    <Text style={s.schedFreq}>{sched.frequency.charAt(0).toUpperCase() + sched.frequency.slice(1)} · {accLabel(sched.account_id)}</Text>
                  </View>
                  <View style={s.schedBadge}>
                    <Text style={[s.schedBadgeTxt, { color: sched.is_active ? C.success : C.gray }]}>{sched.is_active ? 'Active' : 'Paused'}</Text>
                  </View>
                </View>
                <View style={s.schedMid}>
                  <Text style={s.schedDetail}>Next: {fmtDate(sched.next_run)}</Text>
                  {sched.end_date && <Text style={s.schedDetail}>Ends: {fmtDate(sched.end_date)}</Text>}
                </View>
                <View style={s.schedActions}>
                  <TouchableOpacity style={[s.schedActionBtn, { backgroundColor: sched.is_active ? `${C.warning}15` : `${C.success}15` }]} onPress={() => handleToggle(sched)} testID={`toggle-${sched.id}`}>
                    <Ionicons name={sched.is_active ? 'pause' : 'play'} size={16} color={sched.is_active ? C.warning : C.success} />
                    <Text style={[s.schedActionTxt, { color: sched.is_active ? C.warning : C.success }]}>{sched.is_active ? 'Pause' : 'Resume'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.schedDeleteBtn} onPress={() => handleDelete(sched)} testID={`delete-${sched.id}`}>
                    <Ionicons name="trash-outline" size={16} color={cc.primary} />
                    <Text style={[s.schedActionTxt, { color: cc.primary }]}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Create Modal */}
      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>New Schedule</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}><Ionicons name="close" size={24} color={C.darkGray} /></TouchableOpacity>
            </View>

            {/* Account */}
            <Text style={s.fLabel}>Account</Text>
            <View style={s.accRow}>
              {accounts.map((acc, i) => (
                <TouchableOpacity key={acc.id} style={[s.accOption, selAccIdx === i && { backgroundColor: cc.primary }]} onPress={() => setSelAccIdx(i)} testID={`modal-acc-${i}`}>
                  <Text style={[s.accOptionTxt, selAccIdx === i && { color: C.white }]}>{acc.account_type === 'checking' ? 'Current' : 'Savings'}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Amount */}
            <Text style={s.fLabel}>Amount</Text>
            <View style={s.modalInputRow}>
              <Text style={s.modalCurr}>£</Text>
              <TextInput style={s.modalInput} placeholder="0.00" placeholderTextColor={C.gray} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" testID="modal-amount" />
            </View>

            {/* Frequency */}
            <Text style={s.fLabel}>Frequency</Text>
            <View style={s.freqRow}>
              <TouchableOpacity style={[s.freqBtn, frequency === 'weekly' && { backgroundColor: cc.primary }]} onPress={() => setFrequency('weekly')} testID="freq-weekly">
                <Ionicons name="calendar" size={18} color={frequency === 'weekly' ? C.white : C.gray} />
                <Text style={[s.freqTxt, frequency === 'weekly' && { color: C.white }]}>Weekly</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.freqBtn, frequency === 'monthly' && { backgroundColor: cc.primary }]} onPress={() => setFrequency('monthly')} testID="freq-monthly">
                <Ionicons name="calendar-outline" size={18} color={frequency === 'monthly' ? C.white : C.gray} />
                <Text style={[s.freqTxt, frequency === 'monthly' && { color: C.white }]}>Monthly</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={[s.createBtn, isSaving && { opacity: 0.7 }, { backgroundColor: cc.primary }]} onPress={handleCreate} disabled={isSaving} testID="create-schedule-btn">
              {isSaving ? <ActivityIndicator color={C.white} /> : <Text style={s.createTxt}>Create Schedule</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: C.white, margin: 16, padding: 16, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed' },
  addTxt: { fontSize: 16, fontWeight: '600', marginLeft: 8 },
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: C.darkGray, marginTop: 16 },
  emptySub: { fontSize: 14, color: C.gray, marginTop: 8, textAlign: 'center', paddingHorizontal: 32 },
  listTitle: { fontSize: 16, fontWeight: '600', color: C.darkGray, marginHorizontal: 16, marginBottom: 12 },
  schedCard: { backgroundColor: C.white, marginHorizontal: 16, marginBottom: 12, borderRadius: 8, padding: 16 },
  schedInactive: { opacity: 0.6 },
  schedTop: { flexDirection: 'row', alignItems: 'center' },
  schedIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  schedInfo: { flex: 1 },
  schedAmt: { fontSize: 18, fontWeight: '700', color: C.darkGray },
  schedFreq: { fontSize: 13, color: C.gray, marginTop: 2 },
  schedBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  schedBadgeTxt: { fontSize: 12, fontWeight: '600' },
  schedMid: { flexDirection: 'row', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  schedDetail: { fontSize: 13, color: C.gray, marginRight: 16 },
  schedActions: { flexDirection: 'row', marginTop: 12, gap: 10 },
  schedActionBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  schedDeleteBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#FDEDEE' },
  schedActionTxt: { fontSize: 13, fontWeight: '600', marginLeft: 4 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: C.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: C.darkGray },
  fLabel: { fontSize: 13, fontWeight: '600', color: C.gray, marginBottom: 8, marginTop: 12 },
  accRow: { flexDirection: 'row', gap: 10 },
  accOption: { flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: C.lightGray, alignItems: 'center' },
  accOptionTxt: { fontSize: 14, fontWeight: '600', color: C.darkGray },
  modalInputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.lightGray, borderRadius: 8, paddingHorizontal: 16 },
  modalCurr: { fontSize: 20, fontWeight: '700', color: C.darkGray, marginRight: 8 },
  modalInput: { flex: 1, height: 52, fontSize: 20, fontWeight: '700', color: C.darkGray },
  freqRow: { flexDirection: 'row', gap: 10 },
  freqBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 8, backgroundColor: C.lightGray },
  freqTxt: { fontSize: 14, fontWeight: '600', color: C.darkGray, marginLeft: 8 },
  createBtn: { height: 52, borderRadius: 4, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  createTxt: { color: C.white, fontSize: 16, fontWeight: '600' },
});
