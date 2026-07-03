/**
 * Manage Users — settings page that lists every saved login profile and
 * lets you add new ones, edit, delete, or switch the active user.
 *
 * The profile list is shared with the login screen via AsyncStorage
 * (`saved_profiles` and `active_profile_id`). Switching here also calls
 * `PUT /profile` so the in-app header instantly reflects the new name.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../src/services/api';
import { useAuth } from '../src/context/AuthContext';
import { useCustomization } from '../src/context/CustomizationContext';
import { switchActiveUser } from '../src/services/user-scope';
import BackButton from '../src/components/BackButton';

interface UserProfile {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

const PROFILES_KEY = 'saved_profiles';
const ACTIVE_PROFILE_KEY = 'active_profile_id';

export default function UsersScreen() {
  const { colors: cc, headerTextColor } = useCustomization();
  const { refreshUser } = useAuth();
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<UserProfile>({ id: '', name: '', email: '', phone: '', address: '' });

  const load = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(PROFILES_KEY);
      const ids = await AsyncStorage.getItem(ACTIVE_PROFILE_KEY);
      let list: UserProfile[] = raw ? JSON.parse(raw) : [];
      // Seed a default user when this is the first time the screen is opened.
      // The login screen otherwise lazily creates these, so the list can be
      // empty until the user first edits something on the login page.
      if (!list.length) {
        list = [
          {
            id: 'oliver-default',
            name: 'Oliver',
            email: 'oliver@hsbc.co.uk',
            phone: '+44 7700 900000',
            address: '8 Canada Square, London',
          },
        ];
        await AsyncStorage.setItem(PROFILES_KEY, JSON.stringify(list));
        if (!ids) await AsyncStorage.setItem(ACTIVE_PROFILE_KEY, list[0].id);
      }
      setProfiles(list);
      setActiveId(ids || list[0].id);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const persist = async (next: UserProfile[]) => {
    setProfiles(next);
    await AsyncStorage.setItem(PROFILES_KEY, JSON.stringify(next));
  };

  const switchTo = async (p: UserProfile) => {
    setActiveId(p.id);
    // Use the user-scope helper so the offline-store cache is busted and
    // CustomizationContext reloads — guarantees the new user sees their
    // own theme + data immediately, with no stale state from the previous
    // session.
    await switchActiveUser(p.id);
    try {
      // Sync the active profile data into the offline-store profile so the
      // app header / personal-details / receipts reflect the new user.
      await api.put('/profile', {
        name: p.name,
        email: p.email || '',
        phone: p.phone || '',
        address: p.address || '',
      });
      await refreshUser();
    } catch {
      /* ignore network errors — offline adapter never fails here */
    }
    Alert.alert('Switched user', `You are now using HSBC Mobile Banking as ${p.name}.`);
  };

  const openAdd = () => {
    setEditingId(null);
    setDraft({ id: '', name: '', email: '', phone: '', address: '' });
    setEditorOpen(true);
  };

  const openEdit = (p: UserProfile) => {
    setEditingId(p.id);
    setDraft({ ...p });
    setEditorOpen(true);
  };

  const saveDraft = async () => {
    if (!draft.name.trim()) {
      Alert.alert('Name required', 'Please enter the user\'s name.');
      return;
    }
    if (editingId) {
      const next = profiles.map((p) => (p.id === editingId ? { ...draft, id: editingId } : p));
      await persist(next);
      if (editingId === activeId) {
        const updated = next.find((p) => p.id === editingId);
        if (updated) await switchTo(updated);
      }
    } else {
      const created: UserProfile = { ...draft, id: `usr-${Date.now()}` };
      const next = [...profiles, created];
      await persist(next);
      // Make the new user active automatically — that's what people expect
      // when they tap "Add user" in a banking app.
      await switchTo(created);
    }
    setEditorOpen(false);
  };

  const removeUser = (p: UserProfile) => {
    if (profiles.length <= 1) {
      Alert.alert('Cannot delete', 'You must keep at least one user account.');
      return;
    }
    Alert.alert('Remove user', `Delete "${p.name}" from this device?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const next = profiles.filter((x) => x.id !== p.id);
          await persist(next);
          if (activeId === p.id && next[0]) {
            await switchTo(next[0]);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={[s.header, { backgroundColor: cc.header }]}>
        <BackButton color={headerTextColor} />
        <Text style={[s.headerTitle, { color: headerTextColor }]}>Manage Users</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={s.intro}>
          <View style={[s.introIcon, { backgroundColor: `${cc.primary}15` }]}>
            <Ionicons name="people-outline" size={22} color={cc.primary} />
          </View>
          <Text style={s.introTitle}>Multiple users on this device</Text>
          <Text style={s.introSub}>Add family members or use different identities. Each user signs in with any 4-digit passcode or Face ID — and sees their own name across the app.</Text>
        </View>

        {profiles.map((p) => {
          const active = p.id === activeId;
          const initial = (p.name || '?').trim().charAt(0).toUpperCase();
          return (
            <View key={p.id} style={[s.userCard, active && { borderColor: cc.primary, borderWidth: 2 }]}>
              <View style={[s.avatar, { backgroundColor: cc.primary }]}>
                <Text style={s.avatarText}>{initial}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={s.nameRow}>
                  <Text style={s.userName}>{p.name}</Text>
                  {active && (
                    <View style={[s.activeBadge, { backgroundColor: `${cc.primary}15` }]}>
                      <Text style={[s.activeBadgeText, { color: cc.primary }]}>ACTIVE</Text>
                    </View>
                  )}
                </View>
                {!!p.email && <Text style={s.userMeta}>{p.email}</Text>}
                {!!p.phone && <Text style={s.userMeta}>{p.phone}</Text>}
                <View style={s.actionRow}>
                  {!active && (
                    <TouchableOpacity style={[s.actionBtn, { backgroundColor: cc.primary }]} onPress={() => switchTo(p)} testID={`switch-${p.id}`}>
                      <Ionicons name="swap-horizontal" size={14} color="#fff" />
                      <Text style={s.actionBtnText}>Switch</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={s.actionGhost} onPress={() => openEdit(p)} testID={`edit-${p.id}`}>
                    <Ionicons name="pencil" size={14} color="#5E6A7A" />
                    <Text style={s.actionGhostText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.actionGhost} onPress={() => removeUser(p)} testID={`remove-${p.id}`}>
                    <Ionicons name="trash-outline" size={14} color="#DB0011" />
                    <Text style={[s.actionGhostText, { color: '#DB0011' }]}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })}

        <TouchableOpacity style={[s.addBtn, { borderColor: cc.primary }]} onPress={openAdd} testID="add-user-btn">
          <Ionicons name="person-add-outline" size={18} color={cc.primary} />
          <Text style={[s.addBtnText, { color: cc.primary }]}>Add new user</Text>
        </TouchableOpacity>

        <Text style={s.footnote}>Signing in works for every user with any 4-digit code or Face ID. Each user keeps their own theme, balances, transactions and personal details — switching from the (ⓘ) icon at the top of the app instantly loads that user's data.</Text>
      </ScrollView>

      {/* Add / Edit modal */}
      <Modal visible={editorOpen} transparent animationType="fade" onRequestClose={() => setEditorOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalBackdrop}>
          <View style={s.modalSheet}>
            <Text style={s.modalTitle}>{editingId ? 'Edit user' : 'Add new user'}</Text>
            <Text style={s.fieldLabel}>Full name</Text>
            <TextInput value={draft.name} onChangeText={(t) => setDraft({ ...draft, name: t })} style={s.input} placeholder="e.g. Jane Smith" placeholderTextColor="#9AA3AF" testID="draft-name" />
            <Text style={s.fieldLabel}>Email</Text>
            <TextInput value={draft.email} onChangeText={(t) => setDraft({ ...draft, email: t })} style={s.input} placeholder="jane@example.co.uk" placeholderTextColor="#9AA3AF" keyboardType="email-address" autoCapitalize="none" testID="draft-email" />
            <Text style={s.fieldLabel}>Phone</Text>
            <TextInput value={draft.phone} onChangeText={(t) => setDraft({ ...draft, phone: t })} style={s.input} placeholder="+44 7700 900000" placeholderTextColor="#9AA3AF" keyboardType="phone-pad" testID="draft-phone" />
            <Text style={s.fieldLabel}>Address</Text>
            <TextInput value={draft.address} onChangeText={(t) => setDraft({ ...draft, address: t })} style={s.input} placeholder="Street, City, Postcode" placeholderTextColor="#9AA3AF" testID="draft-address" />
            <View style={s.modalActions}>
              <TouchableOpacity style={s.modalCancel} onPress={() => setEditorOpen(false)}>
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalSave, { backgroundColor: cc.primary }]} onPress={saveDraft} testID="save-draft-btn">
                <Text style={s.modalSaveText}>{editingId ? 'Save changes' : 'Add user'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  header: { paddingHorizontal: 12, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  intro: { padding: 20 },
  introIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  introTitle: { fontSize: 17, fontWeight: '700', color: '#0B1424', marginBottom: 4 },
  introSub: { fontSize: 13, color: '#5E6A7A', lineHeight: 18 },
  userCard: { flexDirection: 'row', backgroundColor: '#FFFFFF', marginHorizontal: 16, marginBottom: 12, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#EFF1F4' },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  avatarText: { fontSize: 20, fontWeight: '800', color: '#FFFFFF' },
  nameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  userName: { fontSize: 15, fontWeight: '700', color: '#0B1424', marginRight: 8 },
  activeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  activeBadgeText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.7 },
  userMeta: { fontSize: 12, color: '#8893A3', marginTop: 1 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, gap: 8 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 6 },
  actionBtnText: { color: '#fff', fontSize: 12, fontWeight: '700', marginLeft: 5 },
  actionGhost: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 7 },
  actionGhostText: { color: '#5E6A7A', fontSize: 12, fontWeight: '600', marginLeft: 5 },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginHorizontal: 16, paddingVertical: 14, borderRadius: 10, borderWidth: 1.5, borderStyle: 'dashed', marginTop: 4, marginBottom: 8 },
  addBtnText: { fontSize: 14, fontWeight: '700', marginLeft: 8 },
  footnote: { fontSize: 11, color: '#8893A3', marginHorizontal: 24, marginTop: 8, textAlign: 'center', lineHeight: 16 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 18 },
  modalSheet: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#0B1424', marginBottom: 14 },
  fieldLabel: { fontSize: 12, color: '#5E6A7A', marginTop: 8, marginBottom: 6, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#E5E8EC', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#0B1424', backgroundColor: '#FFFFFF' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 18 },
  modalCancel: { paddingHorizontal: 16, paddingVertical: 11 },
  modalCancelText: { color: '#5E6A7A', fontSize: 14, fontWeight: '600' },
  modalSave: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: 8, marginLeft: 8 },
  modalSaveText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
