import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { useAuth } from '../../src/context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../src/services/api';

const COLORS = { primary: '#DB0011', white: '#FFFFFF', lightGray: '#F5F5F5', gray: '#767676', darkGray: '#333333', black: '#000000', info: '#1574EE', border: '#E5E5E5' };
const PASSCODE_LENGTH = 4;
const PROFILES_KEY = 'login_profiles';
const ACTIVE_PROFILE_KEY = 'active_profile_id';

interface UserProfile {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

const DEFAULT_PROFILE: UserProfile = {
  id: 'default-oliver',
  name: 'Oliver',
  email: 'customer@hsbc.co.uk',
  phone: '+44 7700 900000',
  address: '8 Canada Square, London',
};

export default function LoginScreen() {
  const router = useRouter();
  const { loginWithPasscode, refreshUser } = useAuth();
  const [passcode, setPasscode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const hiddenInputRef = useRef<TextInput>(null);

  // Multi-account state
  const [profiles, setProfiles] = useState<UserProfile[]>([DEFAULT_PROFILE]);
  const [activeProfile, setActiveProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<UserProfile | null>(null);
  const [draft, setDraft] = useState<UserProfile>({ id: '', name: '', email: '', phone: '', address: '' });

  const [biometricLabel, setBiometricLabel] = useState('Use Touch ID');
  const [biometricAvailable, setBiometricAvailable] = useState(true);

  useEffect(() => {
    loadProfiles();
    detectBiometrics();
  }, []);

  const detectBiometrics = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        setBiometricLabel('Use Face ID');
      } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        setBiometricLabel('Use Touch ID');
      } else if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
        setBiometricLabel('Use Iris');
      }
      setBiometricAvailable(hasHardware && enrolled);
    } catch {
      // Web or unsupported: keep label but still allow tap (will fall back)
      setBiometricAvailable(false);
    }
  };

  const handleBiometricLogin = async () => {
    if (isLoading) return;
    try {
      if (Platform.OS === 'web') {
        // Web has no real biometrics — short-circuit straight into the passcode login
        handleLogin('0503');
        return;
      }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: `Sign in to HSBC as ${activeProfile.name}`,
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
        fallbackLabel: 'Use Passcode',
      });
      if (result.success) {
        handleLogin('0503');
      } else if ('error' in result && result.error !== 'user_cancel') {
        Alert.alert('Authentication Failed', 'Please try again or enter your passcode.');
      }
    } catch (e: any) {
      Alert.alert('Biometric Error', e?.message || 'Could not authenticate.');
    }
  };

  const loadProfiles = async () => {
    try {
      const raw = await AsyncStorage.getItem(PROFILES_KEY);
      const activeId = await AsyncStorage.getItem(ACTIVE_PROFILE_KEY);
      let list: UserProfile[] = raw ? JSON.parse(raw) : [DEFAULT_PROFILE];
      if (!list.length) list = [DEFAULT_PROFILE];
      setProfiles(list);
      const active = list.find((p) => p.id === activeId) || list[0];
      setActiveProfile(active);
    } catch {
      // ignore
    }
  };

  const persistProfiles = async (list: UserProfile[]) => {
    await AsyncStorage.setItem(PROFILES_KEY, JSON.stringify(list));
  };

  const setActive = async (p: UserProfile) => {
    setActiveProfile(p);
    await AsyncStorage.setItem(ACTIVE_PROFILE_KEY, p.id);
    setSwitcherOpen(false);
  };

  const handleAddNew = () => {
    setEditingProfile(null);
    setDraft({ id: '', name: '', email: '', phone: '', address: '' });
    setEditorOpen(true);
  };

  const handleEdit = (p: UserProfile) => {
    setEditingProfile(p);
    setDraft({ ...p });
    setEditorOpen(true);
  };

  const handleSaveDraft = async () => {
    if (!draft.name.trim()) {
      Alert.alert('Name required', 'Please enter the user name.');
      return;
    }
    let next: UserProfile[];
    if (editingProfile) {
      next = profiles.map((p) => (p.id === editingProfile.id ? { ...draft, id: editingProfile.id } : p));
    } else {
      const newProfile: UserProfile = { ...draft, id: `usr-${Date.now()}` };
      next = [...profiles, newProfile];
    }
    setProfiles(next);
    await persistProfiles(next);
    if (!editingProfile) {
      const created = next[next.length - 1];
      setActiveProfile(created);
      await AsyncStorage.setItem(ACTIVE_PROFILE_KEY, created.id);
    } else if (editingProfile.id === activeProfile.id) {
      const updated = next.find((p) => p.id === editingProfile.id);
      if (updated) setActiveProfile(updated);
    }
    setEditorOpen(false);
  };

  const handleDelete = async (p: UserProfile) => {
    if (profiles.length === 1) {
      Alert.alert('Cannot Delete', 'You must keep at least one account.');
      return;
    }
    Alert.alert('Delete Account', `Remove "${p.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const next = profiles.filter((x) => x.id !== p.id);
          setProfiles(next);
          await persistProfiles(next);
          if (activeProfile.id === p.id) {
            setActiveProfile(next[0]);
            await AsyncStorage.setItem(ACTIVE_PROFILE_KEY, next[0].id);
          }
        },
      },
    ]);
  };

  const handleDigit = (digit: string) => {
    if (passcode.length >= PASSCODE_LENGTH) return;
    const newPasscode = passcode + digit;
    setPasscode(newPasscode);
    setError('');
    if (newPasscode.length === PASSCODE_LENGTH) handleLogin(newPasscode);
  };

  // Hidden input handler for physical-keyboard / paste support
  const handleTypedInput = (text: string) => {
    // Keep only digits and cap at 4 chars
    const digits = text.replace(/\D/g, '').slice(0, PASSCODE_LENGTH);
    setPasscode(digits);
    setError('');
    if (digits.length === PASSCODE_LENGTH) handleLogin(digits);
  };

  const handleDelete2 = () => {
    setPasscode((prev) => prev.slice(0, -1));
    setError('');
  };

  const handleLogin = async (code: string) => {
    setIsLoading(true);
    try {
      await loginWithPasscode(code);
      // Sync the active profile name/email/phone/address to backend, so the
      // selected identity shows up across the app.
      try {
        await api.put('/profile', {
          name: activeProfile.name,
          email: activeProfile.email || '',
          phone: activeProfile.phone || '',
          address: activeProfile.address || '',
        });
        // Pull the fresh profile back so AuthContext user reflects the new name
        await refreshUser();
      } catch {
        // non-fatal: continue
      }
      router.replace('/(tabs)/home');
    } catch (err: any) {
      setPasscode('');
      setError('Invalid passcode. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

  return (
    <SafeAreaView style={styles.container}>
      {/* Top bar with info icon top-right */}
      <View style={styles.topBar}>
        <View style={{ width: 36 }} />
        <Text style={styles.activeProfileChip}>{activeProfile.name}</Text>
        <TouchableOpacity style={styles.infoBtn} onPress={() => setSwitcherOpen(true)} testID="account-switcher-btn" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="information-circle" size={30} color={COLORS.info} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {/* Hidden input — lets users type the passcode on a physical keyboard.
            We do NOT autoFocus on mount because that would summon the on-screen
            keyboard on mobile and cover the keypad. Tapping the keypad still
            works directly via the on-screen buttons below. */}
        <TextInput
          ref={hiddenInputRef}
          value={passcode}
          onChangeText={handleTypedInput}
          keyboardType="number-pad"
          maxLength={PASSCODE_LENGTH}
          caretHidden
          style={styles.hiddenInput}
          editable={!isLoading}
          testID="hidden-passcode-input"
        />
        {/* Logo */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <View style={styles.hexagonRow}>
              <View style={[styles.hexagon, styles.hexagonRed]} />
              <View style={[styles.hexagon, styles.hexagonWhite]} />
            </View>
            <View style={styles.hexagonRow}>
              <View style={[styles.hexagon, styles.hexagonWhite]} />
              <View style={[styles.hexagon, styles.hexagonRed]} />
            </View>
          </View>
          <Text style={styles.brandName}>HSBC</Text>
        </View>

        {/* Title */}
        <Text style={styles.title}>Welcome, {activeProfile.name.split(' ')[0]}</Text>
        <Text style={styles.subtitle}>Enter any 4-digit security passcode</Text>

        {/* Dots */}
        <View style={styles.dotsContainer}>
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              style={[styles.dot, passcode.length > i && styles.dotFilled, error ? styles.dotError : null]}
            />
          ))}
        </View>

        {error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={16} color={COLORS.primary} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {isLoading ? <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} /> : null}

        {/* Keypad */}
        <View style={styles.keypad}>
          {digits.map((digit, i) => {
            if (digit === '') return <View key={i} style={styles.keyEmpty} />;
            if (digit === 'del') {
              return (
                <TouchableOpacity key={i} style={styles.key} onPress={handleDelete2} testID="passcode-delete">
                  <Ionicons name="backspace-outline" size={26} color={COLORS.darkGray} />
                </TouchableOpacity>
              );
            }
            return (
              <TouchableOpacity key={i} style={styles.key} onPress={() => handleDigit(digit)} disabled={isLoading} testID={`passcode-key-${digit}`}>
                <Text style={styles.keyText}>{digit}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={styles.biometricHint}
          onPress={handleBiometricLogin}
          disabled={isLoading}
          testID="biometric-login"
          activeOpacity={0.6}
        >
          <Ionicons name="finger-print" size={22} color={COLORS.primary} />
          <Text style={styles.biometricText}>{biometricLabel}</Text>
        </TouchableOpacity>
      </View>

      {/* Account Switcher Modal */}
      <Modal visible={switcherOpen} transparent animationType="slide" onRequestClose={() => setSwitcherOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Account</Text>
              <TouchableOpacity onPress={() => setSwitcherOpen(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={26} color={COLORS.darkGray} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalHint}>Enter any 4-digit passcode to sign in.</Text>
            <ScrollView style={{ maxHeight: 380 }}>
              {profiles.map((p) => {
                const active = p.id === activeProfile.id;
                return (
                  <View key={p.id} style={styles.profileRow}>
                    <TouchableOpacity style={styles.profileMain} onPress={() => setActive(p)} testID={`profile-${p.id}`}>
                      <View style={[styles.avatar, active && { borderColor: COLORS.primary, borderWidth: 2 }]}>
                        <Text style={[styles.avatarText, { color: COLORS.primary }]}>{p.name.charAt(0).toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.profileName}>{p.name}</Text>
                        {p.email ? <Text style={styles.profileSub}>{p.email}</Text> : null}
                      </View>
                      {active && <Ionicons name="checkmark-circle" size={22} color={COLORS.primary} />}
                    </TouchableOpacity>
                    <View style={styles.profileActions}>
                      <TouchableOpacity onPress={() => handleEdit(p)} testID={`edit-profile-${p.id}`}>
                        <Ionicons name="create-outline" size={20} color={COLORS.gray} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDelete(p)} style={{ marginLeft: 14 }} testID={`delete-profile-${p.id}`}>
                        <Ionicons name="trash-outline" size={20} color={COLORS.gray} />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
            <TouchableOpacity style={styles.addBtn} onPress={handleAddNew} testID="add-new-account">
              <Ionicons name="add-circle" size={22} color={COLORS.primary} />
              <Text style={styles.addBtnText}>Add new account</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Editor Modal */}
      <Modal visible={editorOpen} transparent animationType="slide" onRequestClose={() => setEditorOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.editorOverlay}>
          <View style={styles.editorCard}>
            <View style={styles.editorHeader}>
              <Text style={styles.modalTitle}>{editingProfile ? 'Edit Account' : 'New Account'}</Text>
              <TouchableOpacity onPress={() => setEditorOpen(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} testID="editor-close">
                <Ionicons name="close" size={24} color={COLORS.darkGray} />
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 4 }}>
              <Text style={styles.fieldLabel}>Name *</Text>
              <TextInput style={styles.fieldInput} value={draft.name} onChangeText={(v) => setDraft({ ...draft, name: v })} placeholder="Oliver Smith" placeholderTextColor={COLORS.gray} testID="draft-name" returnKeyType="next" />

              <Text style={styles.fieldLabel}>Email</Text>
              <TextInput style={styles.fieldInput} value={draft.email} onChangeText={(v) => setDraft({ ...draft, email: v })} placeholder="oliver@example.com" placeholderTextColor={COLORS.gray} keyboardType="email-address" autoCapitalize="none" testID="draft-email" returnKeyType="next" />

              <Text style={styles.fieldLabel}>Phone</Text>
              <TextInput style={styles.fieldInput} value={draft.phone} onChangeText={(v) => setDraft({ ...draft, phone: v })} placeholder="+44 7700 900000" placeholderTextColor={COLORS.gray} keyboardType="phone-pad" testID="draft-phone" returnKeyType="next" />

              <Text style={styles.fieldLabel}>Address</Text>
              <TextInput style={styles.fieldInput} value={draft.address} onChangeText={(v) => setDraft({ ...draft, address: v })} placeholder="8 Canada Square, London" placeholderTextColor={COLORS.gray} testID="draft-address" returnKeyType="done" onSubmitEditing={handleSaveDraft} />
            </ScrollView>

            <View style={styles.editorBtns}>
              <TouchableOpacity style={styles.editorCancel} onPress={() => setEditorOpen(false)}>
                <Text style={styles.editorCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.editorSave} onPress={handleSaveDraft} testID="save-draft">
                <Text style={styles.editorSaveText}>{editingProfile ? 'Save Changes' : 'Create Account'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  activeProfileChip: { fontSize: 13, color: COLORS.gray, fontWeight: '500' },
  infoBtn: { padding: 4, width: 36, alignItems: 'flex-end' },
  content: { flex: 1, alignItems: 'center', paddingHorizontal: 32, paddingTop: 12 },
  header: { alignItems: 'center', marginBottom: 24 },
  logoContainer: { marginBottom: 8 },
  hexagonRow: { flexDirection: 'row' },
  hexagon: { width: 22, height: 22, margin: 1 },
  hexagonRed: { backgroundColor: COLORS.primary },
  hexagonWhite: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.primary },
  brandName: { fontSize: 28, fontWeight: '700', color: COLORS.primary, letterSpacing: 4 },
  title: { fontSize: 22, fontWeight: '600', color: COLORS.darkGray, marginBottom: 8 },
  subtitle: { fontSize: 14, color: COLORS.gray, marginBottom: 28 },
  dotsContainer: { flexDirection: 'row', marginBottom: 22 },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: '#D0D0D0', marginHorizontal: 10 },
  dotFilled: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  dotError: { borderColor: COLORS.primary, backgroundColor: 'transparent' },
  errorContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  errorText: { fontSize: 14, color: COLORS.primary, marginLeft: 6, fontWeight: '500' },
  loader: { marginBottom: 12 },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', width: 280, marginTop: 8 },
  key: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', margin: 8, backgroundColor: COLORS.lightGray },
  keyEmpty: { width: 72, height: 72, margin: 8 },
  keyText: { fontSize: 28, fontWeight: '500', color: COLORS.darkGray },
  biometricHint: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  biometricText: { fontSize: 14, color: COLORS.primary, fontWeight: '500', marginLeft: 8 },
  hiddenInput: { position: 'absolute', opacity: 0, width: 1, height: 1, top: 0, left: 0 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: COLORS.white, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 30 },
  modalHandle: { width: 44, height: 4, backgroundColor: COLORS.border, alignSelf: 'center', borderRadius: 2, marginBottom: 14 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.darkGray },
  modalHint: { fontSize: 12, color: COLORS.gray, marginTop: 4, marginBottom: 12 },
  profileRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  profileMain: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFE6E8', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '700' },
  profileName: { fontSize: 16, fontWeight: '600', color: COLORS.darkGray },
  profileSub: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  profileActions: { flexDirection: 'row', alignItems: 'center', marginLeft: 8 },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 14, paddingVertical: 12, borderRadius: 10, backgroundColor: COLORS.lightGray },
  addBtnText: { fontSize: 15, color: COLORS.primary, fontWeight: '600', marginLeft: 8 },

  // Editor
  editorOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  editorCard: { backgroundColor: COLORS.white, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24, maxHeight: '90%' },
  editorHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  fieldLabel: { fontSize: 13, color: COLORS.gray, marginTop: 10, marginBottom: 4, fontWeight: '500' },
  fieldInput: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: COLORS.darkGray },
  editorBtns: { flexDirection: 'row', marginTop: 20, gap: 10 },
  editorCancel: { flex: 1, height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.lightGray },
  editorCancelText: { fontSize: 15, color: COLORS.darkGray, fontWeight: '600' },
  editorSave: { flex: 1, height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary },
  editorSaveText: { fontSize: 15, color: COLORS.white, fontWeight: '700' },
});
