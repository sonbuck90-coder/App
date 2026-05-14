import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { useCustomization } from '../../src/context/CustomizationContext';
import { Linking, Platform } from 'react-native';

// HSBC Colors
const COLORS = {
  primary: '#DB0011',
  secondary: '#333333',
  white: '#FFFFFF',
  lightGray: '#F5F5F5',
  gray: '#767676',
  darkGray: '#333333',
  black: '#000000',
  success: '#00847F',
  background: '#F5F5F5',
};

export default function ProfileScreen() {
  const { user, logout, refreshUser } = useAuth();

  // Refresh the user on every focus so any change made in Personal Details
  // (name / email) propagates back to this screen automatically.
  useFocusEffect(
    useCallback(() => {
      refreshUser();
    }, [])
  );
  const { colors: customColors, headerTextColor, bankPhone } = useCustomization();
  const router = useRouter();

  const callBank = () => {
    const num = (bankPhone || '').replace(/\s/g, '');
    if (!num) {
      Alert.alert('No number set', 'Please set the bank phone number in Customization.');
      return;
    }
    const url = `tel:${num}`;
    if (Platform.OS === 'web') {
      // window is available only on web; use Linking as a fallback otherwise.
      try {
        // eslint-disable-next-line no-undef
        (window as any).open(url, '_self');
      } catch {
        Linking.openURL(url).catch(() =>
          Alert.alert('Cannot call', 'Calling is not available on this device.')
        );
      }
    } else {
      Linking.openURL(url).catch(() =>
        Alert.alert('Cannot call', 'Calling is not available on this device.')
      );
    }
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const menuSections = [
    {
      title: 'Account & Settings',
      items: [
        { icon: 'people-outline', label: 'Manage Payees', chevron: true, onPress: () => router.push('/payees') },
        { icon: 'analytics-outline', label: 'Spending Insights', chevron: true, onPress: () => router.push('/analytics') },
        { icon: 'speedometer-outline', label: 'Monthly Budgets', chevron: true, onPress: () => router.push('/budgets') },
        { icon: 'calendar-outline', label: 'Scheduled Deposits', chevron: true, onPress: () => router.push('/schedules') },
        { icon: 'chatbubbles-outline', label: 'AI Assistant', chevron: true, onPress: () => router.push('/chat') },
        { icon: 'color-palette-outline', label: 'Customization', chevron: true, onPress: () => router.push('/customization') },
        { icon: 'person-outline', label: 'Personal Details', chevron: true, onPress: () => router.push('/personal-details') },
        { icon: 'lock-closed-outline', label: 'Security Settings', chevron: true },
        { icon: 'notifications-outline', label: 'Notifications', chevron: true },
        { icon: 'finger-print-outline', label: 'Biometric Login', toggle: true },
      ],
    },
    {
      title: 'Help & Support',
      items: [
        { icon: 'chatbubble-outline', label: 'Contact Us', chevron: true },
        { icon: 'help-circle-outline', label: 'FAQs', chevron: true },
        { icon: 'location-outline', label: 'Branch & ATM Locator', chevron: true },
        { icon: 'call-outline', label: 'Call Support', subtitle: bankPhone, onPress: callBank, chevron: true },
      ],
    },
    {
      title: 'Legal',
      items: [
        { icon: 'document-text-outline', label: 'Terms & Conditions', chevron: true },
        { icon: 'shield-outline', label: 'Privacy Policy', chevron: true },
        { icon: 'information-circle-outline', label: 'About HSBC', chevron: true },
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: customColors.header }]}>
        <Text style={[styles.headerTitle, { color: headerTextColor }]}>More</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* User Card */}
        <View style={styles.userCard}>
          <View style={[styles.userAvatar, { backgroundColor: customColors.primary }]}>
            <Text style={styles.avatarText}>
              {user?.name?.split(' ').map((n) => n[0]).join('').toUpperCase() || 'U'}
            </Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.name || 'User'}</Text>
            <Text style={styles.userEmail}>{user?.email || 'user@example.com'}</Text>
          </View>
          <TouchableOpacity style={styles.editButton}>
            <Ionicons name="chevron-forward" size={20} color={COLORS.gray} />
          </TouchableOpacity>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActionsCard}>
          <TouchableOpacity style={styles.quickActionItem}>
            <View style={styles.quickActionIcon}>
              <Ionicons name="qr-code-outline" size={22} color={COLORS.primary} />
            </View>
            <Text style={styles.quickActionText}>My QR Code</Text>
          </TouchableOpacity>
          <View style={styles.quickActionDivider} />
          <TouchableOpacity style={styles.quickActionItem}>
            <View style={styles.quickActionIcon}>
              <Ionicons name="document-outline" size={22} color={COLORS.primary} />
            </View>
            <Text style={styles.quickActionText}>Statements</Text>
          </TouchableOpacity>
          <View style={styles.quickActionDivider} />
          <TouchableOpacity style={styles.quickActionItem}>
            <View style={styles.quickActionIcon}>
              <Ionicons name="settings-outline" size={22} color={COLORS.primary} />
            </View>
            <Text style={styles.quickActionText}>Settings</Text>
          </TouchableOpacity>
        </View>

        {/* Menu Sections */}
        {menuSections.map((section, sectionIndex) => (
          <View key={sectionIndex} style={styles.menuSection}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.menuCard}>
              {section.items.map((item, itemIndex) => (
                <TouchableOpacity
                  key={itemIndex}
                  style={[
                    styles.menuItem,
                    itemIndex < section.items.length - 1 && styles.menuItemBorder,
                  ]}
                  onPress={item.onPress}
                >
                  <View style={styles.menuItemLeft}>
                    <Ionicons name={item.icon as any} size={22} color={COLORS.darkGray} />
                    <View style={styles.menuItemTextContainer}>
                      <Text style={styles.menuItemLabel}>{item.label}</Text>
                      {item.subtitle && (
                        <Text style={styles.menuItemSubtitle}>{item.subtitle}</Text>
                      )}
                    </View>
                  </View>
                  {item.chevron && (
                    <Ionicons name="chevron-forward" size={18} color={COLORS.gray} />
                  )}
                  {item.toggle && (
                    <View style={styles.toggle}>
                      <View style={styles.toggleKnob} />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color={COLORS.primary} />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        {/* App Version */}
        <Text style={styles.versionText}>HSBC Mobile Banking v2.04.6</Text>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.white,
  },
  scrollView: {
    flex: 1,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    margin: 16,
    padding: 16,
    borderRadius: 8,
  },
  userAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.white,
  },
  userInfo: {
    flex: 1,
    marginLeft: 16,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.darkGray,
  },
  userEmail: {
    fontSize: 14,
    color: COLORS.gray,
    marginTop: 2,
  },
  editButton: {
    padding: 8,
  },
  quickActionsCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 8,
    padding: 16,
  },
  quickActionItem: {
    flex: 1,
    alignItems: 'center',
  },
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickActionText: {
    fontSize: 12,
    color: COLORS.darkGray,
    fontWeight: '500',
  },
  quickActionDivider: {
    width: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 8,
  },
  menuSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.gray,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  menuCard: {
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    borderRadius: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuItemTextContainer: {
    marginLeft: 16,
    flex: 1,
  },
  menuItemLabel: {
    fontSize: 15,
    color: COLORS.darkGray,
  },
  menuItemSubtitle: {
    fontSize: 13,
    color: COLORS.gray,
    marginTop: 2,
  },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    padding: 2,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.white,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
    padding: 16,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
    marginLeft: 8,
  },
  versionText: {
    fontSize: 12,
    color: COLORS.gray,
    textAlign: 'center',
    marginTop: 16,
  },
  bottomPadding: {
    height: 40,
  },
});
