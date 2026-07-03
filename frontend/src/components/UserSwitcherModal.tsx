/**
 * UserSwitcher — bottom-sheet style modal that lists every saved profile
 * and lets the user instantly switch between them.
 *
 * Opens when the "info" (ⓘ) icon in the top-right header is tapped.
 * Per-user data isolation is handled by `user-scope.ts`: switching the
 * active id reloads the customization context and busts the offline-store
 * cache so the new user sees their own theme, name, accounts, and txns.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  ScrollView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCustomization } from '../context/CustomizationContext';
import { useAuth } from '../context/AuthContext';
import { switchActiveUser, PROFILES_KEY, ACTIVE_PROFILE_KEY, DEFAULT_USER_ID } from '../services/user-scope';

interface SavedProfile {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function UserSwitcherModal({ visible, onClose }: Props) {
  const { colors: cc } = useCustomization();
  const { refreshUser } = useAuth();
  const router = useRouter();
  const [profiles, setProfiles] = useState<SavedProfile[]>([]);
  const [activeId, setActiveId] = useState<string>(DEFAULT_USER_ID);
  const [switching, setSwitching] = useState(false);

  const reload = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(PROFILES_KEY);
      const active = await AsyncStorage.getItem(ACTIVE_PROFILE_KEY);
      let list: SavedProfile[] = raw ? JSON.parse(raw) : [];
      if (!list.length) {
        // Seed with the default Oliver profile so the sheet never opens empty.
        list = [
          {
            id: DEFAULT_USER_ID,
            name: 'Oliver',
            email: 'oliver@hsbc.co.uk',
            phone: '+44 7700 900000',
            address: '8 Canada Square, London',
          },
        ];
        await AsyncStorage.setItem(PROFILES_KEY, JSON.stringify(list));
        if (!active) await AsyncStorage.setItem(ACTIVE_PROFILE_KEY, DEFAULT_USER_ID);
      }
      setProfiles(list);
      setActiveId(active || list[0].id);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (visible) reload();
  }, [visible, reload]);

  const handleSwitch = async (p: SavedProfile) => {
    if (p.id === activeId || switching) return;
    setSwitching(true);
    try {
      await switchActiveUser(p.id);
      // Contexts subscribed to onActiveUserChange will reload themselves.
      await refreshUser();
      setActiveId(p.id);
      onClose();
      // Snap to home so any open sub-screen re-renders with the new theme.
      setTimeout(() => {
        try { router.replace('/(tabs)/home' as any); } catch { /* ignore */ }
      }, 80);
    } finally {
      setSwitching(false);
    }
  };

  const handleManageUsers = () => {
    onClose();
    setTimeout(() => {
      try { router.push('/users'); } catch { /* ignore */ }
    }, 80);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={s.handle} />
          <Text style={s.title}>Switch user</Text>
          <Text style={s.subtitle}>
            Each user keeps their own theme, personal details, balances and transactions.
          </Text>

          <ScrollView style={{ maxHeight: 380 }} contentContainerStyle={{ paddingVertical: 4 }}>
            {profiles.map((p) => {
              const active = p.id === activeId;
              const initial = (p.name || '?').trim().charAt(0).toUpperCase();
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[s.row, active && { backgroundColor: `${cc.primary}10`, borderColor: cc.primary }]}
                  onPress={() => handleSwitch(p)}
                  disabled={switching}
                  activeOpacity={0.7}
                  testID={`switch-user-${p.id}`}
                >
                  <View style={[s.avatar, { backgroundColor: cc.primary }]}>
                    <Text style={s.avatarText}>{initial}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.name}>{p.name}</Text>
                    {!!p.email && <Text style={s.email}>{p.email}</Text>}
                  </View>
                  {active ? (
                    <View style={[s.activeBadge, { backgroundColor: cc.primary }]}>
                      <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                    </View>
                  ) : (
                    <Ionicons name="chevron-forward" size={20} color="#9AA3AF" />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <TouchableOpacity
            style={[s.manageBtn, { borderColor: cc.primary }]}
            onPress={handleManageUsers}
            testID="manage-users-btn"
          >
            <Ionicons name="people-outline" size={18} color={cc.primary} />
            <Text style={[s.manageText, { color: cc.primary }]}>Manage users · Add new</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.cancel} onPress={onClose} testID="user-switch-cancel">
            <Text style={s.cancelText}>Close</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 22,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#D6DAE0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    color: '#0B1424',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#5E6A7A',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 16,
    lineHeight: 18,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EFF1F4',
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { color: '#FFFFFF', fontWeight: '800', fontSize: 17 },
  name: { fontSize: 15, fontWeight: '700', color: '#0B1424' },
  email: { fontSize: 12, color: '#8893A3', marginTop: 2 },
  activeBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    marginTop: 4,
  },
  manageText: { fontSize: 14, fontWeight: '700', marginLeft: 8 },
  cancel: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 6,
  },
  cancelText: { color: '#5E6A7A', fontSize: 14, fontWeight: '600' },
});
