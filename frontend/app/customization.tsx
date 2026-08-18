import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Image, ActivityIndicator, Linking, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useCustomization, HSBC_DEFAULTS, LOGO_SIZES } from '../src/context/CustomizationContext';
import { BANK_THEMES } from '../src/context/BankThemes';
import { useAuth } from '../src/context/AuthContext';
import AppLogo from '../src/components/AppLogo';

const APP_VERSION = '2.04.6';

const PRESET_COLORS = [
  { label: 'HSBC Red', value: '#DB0011' },
  { label: 'Royal Blue', value: '#1A3C8F' },
  { label: 'Emerald', value: '#00847F' },
  { label: 'Deep Purple', value: '#5856D6' },
  { label: 'Midnight', value: '#1A1A2E' },
  { label: 'Orange', value: '#FF6B00' },
  { label: 'Forest', value: '#2D5A27' },
  { label: 'Navy', value: '#003366' },
];

// Header presets include light options (White / Black) since the header
// background needs neutral choices to make the HSBC logo pop.
const HEADER_PRESETS = [
  { label: 'White', value: '#FFFFFF' },
  { label: 'Black', value: '#000000' },
  { label: 'HSBC Red', value: '#DB0011' },
  { label: 'Royal Blue', value: '#1A3C8F' },
  { label: 'Emerald', value: '#00847F' },
  { label: 'Midnight', value: '#1A1A2E' },
  { label: 'Navy', value: '#003366' },
  { label: 'Ivory', value: '#F8F4E3' },
];

const ACCENT_COLORS = [
  { label: 'Teal', value: '#00847F' },
  { label: 'Gold', value: '#C4A86C' },
  { label: 'Coral', value: '#FF6B6B' },
  { label: 'Sky Blue', value: '#4FC3F7' },
  { label: 'Lime', value: '#8BC34A' },
  { label: 'Pink', value: '#E91E63' },
];

const SIZE_OPTIONS: Array<{ label: string; value: 'small' | 'medium' | 'large' | 'xlarge' | 'xxlarge' | 'huge' | 'massive' | 'giant' }> = [
  { label: 'Small', value: 'small' },
  { label: 'Medium', value: 'medium' },
  { label: 'Large', value: 'large' },
  { label: 'X-Large', value: 'xlarge' },
  { label: 'XX-Large', value: 'xxlarge' },
  { label: 'Huge', value: 'huge' },
  { label: 'Massive', value: 'massive' },
  { label: 'Giant', value: 'giant' },
];

export default function CustomizationScreen() {
  const router = useRouter();
  const { settings, colors, headerTextColor, updateColors, updateLogo, updateBankPhone, applyBankTheme, resetToDefaults, isCustomized, bankThemeId } = useCustomization();
  const { logout } = useAuth();
  const [logoUrl, setLogoUrl] = useState(settings.logo.url);
  const [bankPhone, setBankPhone] = useState(settings.bankPhone);

  const callBank = () => {
    const num = settings.bankPhone.replace(/\s/g, '');
    const url = `tel:${num}`;
    if (Platform.OS === 'web') {
      window.open(url, '_self');
    } else {
      Linking.openURL(url).catch(() => Alert.alert('Cannot call', 'Calling is not available on this device.'));
    }
  };

  const saveBankPhone = () => {
    if (!bankPhone.trim()) { Alert.alert('Phone required'); return; }
    updateBankPhone(bankPhone.trim());
    Alert.alert('Saved', 'Bank phone number updated.');
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

  const handleLogoUrlSave = () => {
    updateLogo({ url: logoUrl.trim() });
    if (logoUrl.trim()) {
      Alert.alert('Logo Updated', 'Your custom logo has been applied');
    } else {
      Alert.alert('Logo Reset', 'Default logo restored');
    }
  };

  const [isPicking, setIsPicking] = useState(false);

  const handlePickFromGallery = async () => {
    try {
      setIsPicking(true);
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Please allow photo library access to choose a logo.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
        base64: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      const dataUri = asset.base64
        ? `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`
        : asset.uri;
      // Persist as logo url (works for both data URIs and remote URIs)
      updateLogo({ url: dataUri });
      setLogoUrl(dataUri);
      Alert.alert('Logo Updated', 'Your gallery photo is now the app logo.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not load image');
    } finally {
      setIsPicking(false);
    }
  };

  const handleRemoveLogo = () => {
    updateLogo({ url: '' });
    setLogoUrl('');
    Alert.alert('Logo Removed', 'Default HSBC logo restored.');
  };

  const handleReset = () => {
    Alert.alert('Reset to Defaults', 'This will restore all colors and logo to HSBC defaults.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: () => { resetToDefaults(); setLogoUrl(''); Alert.alert('Done', 'Settings restored to HSBC defaults'); } },
    ]);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#F5F5F5' }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: colors.header }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="back-btn">
          <Ionicons name="arrow-back" size={24} color={headerTextColor} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: headerTextColor }]}>Customization</Text>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Preview */}
        <View style={styles.previewCard}>
          <Text style={styles.previewLabel}>Live Preview</Text>
          <View style={[styles.previewBar, { backgroundColor: colors.header }]}>
            <AppLogo variant="header" />
            {(colors.header === '#FFFFFF' || colors.header === '#F8F4E3') ? null : (
              <Text style={[styles.previewTitle, { color: headerTextColor }]}>HSBC Mobile Banking</Text>
            )}
          </View>
          <View style={styles.previewContent}>
            <View style={[styles.previewBtn, { backgroundColor: colors.primary }]}>
              <Text style={styles.previewBtnText}>Primary Button</Text>
            </View>
            <View style={[styles.previewAccent, { borderColor: colors.accent }]}>
              <View style={[styles.previewAccentDot, { backgroundColor: colors.accent }]} />
              <Text style={[styles.previewAccentText, { color: colors.accent }]}>Accent Color</Text>
            </View>
          </View>
        </View>

        {/* Bank Themes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bank Themes</Text>
          <Text style={styles.helpText}>Tap a UK bank to apply its colour palette instantly.</Text>
          <View style={styles.bankGrid}>
            {BANK_THEMES.map((theme) => {
              const active = theme.id === bankThemeId;
              const isLightHeader = theme.colors.header === '#FFFFFF' || theme.colors.header === '#F8F4E3';
              return (
                <TouchableOpacity
                  key={theme.id}
                  style={[styles.bankCard, active && { borderColor: theme.colors.primary, borderWidth: 2 }]}
                  onPress={() => applyBankTheme(theme.id, theme.colors)}
                  testID={`bank-theme-${theme.id}`}
                >
                  <View style={[styles.bankPreview, { backgroundColor: theme.colors.header }]}>
                    <View style={[styles.bankInitialsWrap, { backgroundColor: isLightHeader ? theme.colors.primary : 'rgba(255,255,255,0.18)' }]}>
                      <Text style={[styles.bankInitials, { color: isLightHeader ? '#FFFFFF' : '#FFFFFF' }]}>{theme.initials}</Text>
                    </View>
                  </View>
                  <View style={styles.bankSwatchRow}>
                    <View style={[styles.bankSwatch, { backgroundColor: theme.colors.primary }]} />
                    <View style={[styles.bankSwatch, { backgroundColor: theme.colors.accent }]} />
                    <View style={[styles.bankSwatch, { backgroundColor: theme.colors.header, borderWidth: 1, borderColor: '#E5E8EC' }]} />
                  </View>
                  <Text style={styles.bankName} numberOfLines={1}>{theme.name}</Text>
                  {active && (
                    <View style={[styles.bankActiveBadge, { backgroundColor: theme.colors.primary }]}>
                      <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Logo Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Logo</Text>
          <View style={styles.card}>
            {/* Gallery Picker */}
            <Text style={styles.fieldLabel}>Custom Logo from Gallery</Text>
            <TouchableOpacity
              style={[styles.galleryBtn, { borderColor: colors.primary }]}
              onPress={handlePickFromGallery}
              disabled={isPicking}
              testID="pick-gallery-btn"
            >
              {isPicking ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <>
                  <Ionicons name="images-outline" size={22} color={colors.primary} />
                  <Text style={[styles.galleryBtnText, { color: colors.primary }]}>
                    {settings.logo.url ? 'Choose another photo' : 'Pick photo from gallery'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {settings.logo.url ? (
              <View style={styles.currentLogoRow}>
                <Image source={{ uri: settings.logo.url }} style={styles.currentLogoImg} resizeMode="cover" />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.currentLogoText}>Active logo</Text>
                  <TouchableOpacity onPress={handleRemoveLogo} testID="remove-logo-btn">
                    <Text style={[styles.removeLogoText, { color: colors.primary }]}>Remove & restore default</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            <View style={styles.orDivider}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>OR</Text>
              <View style={styles.orLine} />
            </View>

            <Text style={styles.fieldLabel}>Custom Logo URL</Text>
            <View style={styles.logoInputRow}>
              <TextInput
                style={styles.input}
                placeholder="https://example.com/logo.png"
                placeholderTextColor="#999"
                value={logoUrl}
                onChangeText={setLogoUrl}
                autoCapitalize="none"
                testID="logo-url-input"
              />
              <TouchableOpacity style={[styles.applyBtn, { backgroundColor: colors.primary }]} onPress={handleLogoUrlSave} testID="apply-logo-btn">
                <Text style={styles.applyBtnText}>Apply</Text>
              </TouchableOpacity>
            </View>
            {logoUrl ? (
              <View style={styles.logoPreview}>
                <Image source={{ uri: logoUrl }} style={styles.logoPreviewImg} resizeMode="contain" />
                <TouchableOpacity onPress={() => { setLogoUrl(''); updateLogo({ url: '' }); }}>
                  <Ionicons name="close-circle" size={20} color="#999" />
                </TouchableOpacity>
              </View>
            ) : null}

            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Logo Size</Text>
            <View style={styles.sizeRow}>
              {SIZE_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.sizeBtn, settings.logo.size === opt.value && { backgroundColor: colors.primary }]}
                  onPress={() => updateLogo({ size: opt.value })}
                  testID={`logo-size-${opt.value}`}
                >
                  <Text style={[styles.sizeBtnText, settings.logo.size === opt.value && styles.sizeBtnTextActive]}>{opt.label}</Text>
                  <Text style={[styles.sizePx, settings.logo.size === opt.value && { color: 'rgba(255,255,255,0.7)' }]}>{LOGO_SIZES[opt.value]}px</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Primary Color */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Primary Color</Text>
          <View style={styles.card}>
            <View style={styles.colorGrid}>
              {PRESET_COLORS.map((c) => (
                <TouchableOpacity
                  key={c.value}
                  style={[styles.colorSwatch, { backgroundColor: c.value }, colors.primary === c.value && styles.colorSwatchActive]}
                  onPress={() => updateColors({ primary: c.value, gradientStart: c.value })}
                  testID={`primary-color-${c.value}`}
                >
                  {colors.primary === c.value && <Ionicons name="checkmark" size={18} color="#FFFFFF" />}
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.customColorRow}>
              <Text style={styles.fieldLabel}>Custom Hex</Text>
              <TextInput
                style={[styles.hexInput, { borderColor: colors.primary }]}
                value={colors.primary}
                onChangeText={(t) => { if (/^#[0-9A-Fa-f]{0,6}$/.test(t)) updateColors({ primary: t, gradientStart: t }); }}
                placeholder="#DB0011"
                maxLength={7}
                testID="primary-hex-input"
              />
              <View style={[styles.hexPreview, { backgroundColor: colors.primary }]} />
            </View>
          </View>
        </View>

        {/* Header Color */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Header Color</Text>
          <Text style={styles.sectionHint}>Background colour of the top app bar on every screen.</Text>
          <View style={styles.card}>
            <View style={styles.colorGrid}>
              {HEADER_PRESETS.map((c) => (
                <TouchableOpacity
                  key={c.value}
                  style={[styles.colorSwatch, { backgroundColor: c.value }, colors.header === c.value && styles.colorSwatchActive, (c.value === '#FFFFFF' || c.value === '#F8F4E3') && { borderWidth: 1, borderColor: '#D0D0D0' }]}
                  onPress={() => updateColors({ header: c.value })}
                  testID={`header-color-${c.value}`}
                >
                  {colors.header === c.value && <Ionicons name="checkmark" size={18} color={c.value === '#FFFFFF' || c.value === '#F8F4E3' ? '#000000' : '#FFFFFF'} />}
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.customColorRow}>
              <Text style={styles.fieldLabel}>Custom Hex</Text>
              <TextInput
                style={[styles.hexInput, { borderColor: colors.header }]}
                value={colors.header}
                onChangeText={(t) => { if (/^#[0-9A-Fa-f]{0,6}$/.test(t)) updateColors({ header: t }); }}
                placeholder="#DB0011"
                maxLength={7}
                testID="header-hex-input"
              />
              <View style={[styles.hexPreview, { backgroundColor: colors.header }]} />
            </View>
            <TouchableOpacity
              style={styles.matchPrimaryBtn}
              onPress={() => updateColors({ header: colors.primary })}
              testID="match-primary-btn"
            >
              <Ionicons name="link-outline" size={16} color={colors.primary} />
              <Text style={[styles.matchPrimaryText, { color: colors.primary }]}>Match Primary Color</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Accent Color */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Accent Color</Text>
          <View style={styles.card}>
            <View style={styles.colorGrid}>
              {ACCENT_COLORS.map((c) => (
                <TouchableOpacity
                  key={c.value}
                  style={[styles.colorSwatch, { backgroundColor: c.value }, colors.accent === c.value && styles.colorSwatchActive]}
                  onPress={() => updateColors({ accent: c.value })}
                  testID={`accent-color-${c.value}`}
                >
                  {colors.accent === c.value && <Ionicons name="checkmark" size={18} color="#FFFFFF" />}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Bank Phone Number */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer Service Number</Text>
          <Text style={styles.sectionHint}>This number is used everywhere the bank's helpline is shown. Tapping it from More → Call Bank will start a phone call.</Text>
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>Phone Number</Text>
            <TextInput
              value={bankPhone}
              onChangeText={setBankPhone}
              placeholder="03457 404 404"
              placeholderTextColor="#999"
              keyboardType="phone-pad"
              style={[styles.hexInput, { borderColor: colors.primary, flex: 0, marginRight: 0 }]}
              testID="bank-phone-input"
            />
            <View style={{ flexDirection: 'row', marginTop: 10, gap: 10 }}>
              <TouchableOpacity style={[styles.matchPrimaryBtn, { flex: 1, borderWidth: 1, borderColor: colors.primary, borderRadius: 8, paddingVertical: 12 }]} onPress={callBank} testID="call-bank-btn">
                <Ionicons name="call" size={16} color={colors.primary} />
                <Text style={[styles.matchPrimaryText, { color: colors.primary }]}>Call Now</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.matchPrimaryBtn, { flex: 1, backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 12 }]} onPress={saveBankPhone} testID="save-bank-phone-btn">
                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                <Text style={[styles.matchPrimaryText, { color: '#FFFFFF' }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Save All */}
        <TouchableOpacity
          style={[styles.saveAllBtn, { backgroundColor: colors.primary }]}
          onPress={() => Alert.alert('Saved', 'All customisation changes have been saved on this device.')}
          testID="save-all-btn"
        >
          <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
          <Text style={styles.saveAllBtnText}>Save All Changes</Text>
        </TouchableOpacity>

        {/* Reset */}
        {isCustomized && (
          <TouchableOpacity style={styles.resetBtn} onPress={handleReset} testID="reset-defaults-btn">
            <Ionicons name="refresh" size={20} color="#DB0011" />
            <Text style={styles.resetBtnText}>Reset to HSBC Defaults</Text>
          </TouchableOpacity>
        )}

        {/* Logout */}
        <TouchableOpacity style={[styles.logoutBtn, { backgroundColor: colors.primary }]} onPress={handleLogout} testID="logout-btn">
          <Ionicons name="log-out-outline" size={20} color="#FFFFFF" />
          <Text style={styles.logoutBtnText}>Log Out</Text>
        </TouchableOpacity>

        {/* App version footer */}
        <View style={styles.versionFooter}>
          <AppLogo variant="small" />
          <Text style={styles.versionText}>HSBC Mobile Banking</Text>
          <Text style={styles.versionNumber}>Version {APP_VERSION}</Text>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' },
  backBtn: { marginRight: 16 },
  headerTitle: { fontSize: 20, fontWeight: '600', color: '#FFFFFF' },
  scroll: { flex: 1 },
  previewCard: { backgroundColor: '#FFFFFF', margin: 16, borderRadius: 12, overflow: 'hidden' },
  previewLabel: { fontSize: 12, fontWeight: '600', color: '#767676', padding: 12, paddingBottom: 0 },
  previewBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 18, marginTop: 8, minHeight: 70 },
  previewTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', marginLeft: 12 },
  previewContent: { padding: 12, flexDirection: 'row', alignItems: 'center' },
  previewBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 6, marginRight: 12 },
  previewBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  previewAccent: { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 8 },
  previewAccentDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  previewAccentText: { fontSize: 13, fontWeight: '600' },
  section: { marginHorizontal: 16, marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#333333', marginBottom: 10 },
  sectionHint: { fontSize: 12, color: '#767676', marginBottom: 10, marginTop: -6, lineHeight: 16 },
  matchPrimaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12, paddingVertical: 8 },
  matchPrimaryText: { fontSize: 13, fontWeight: '600', marginLeft: 6 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 8, padding: 16 },
  galleryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 8, paddingVertical: 14, paddingHorizontal: 16, marginTop: 8, marginBottom: 6 },
  galleryBtnText: { fontSize: 14, fontWeight: '600', marginLeft: 10 },
  currentLogoRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, backgroundColor: '#F5F5F5', padding: 12, borderRadius: 8 },
  currentLogoImg: { width: 48, height: 48, borderRadius: 8 },
  currentLogoText: { fontSize: 13, fontWeight: '600', color: '#333333' },
  removeLogoText: { fontSize: 12, fontWeight: '500', marginTop: 4 },
  orDivider: { flexDirection: 'row', alignItems: 'center', marginVertical: 16 },
  orLine: { flex: 1, height: 1, backgroundColor: '#E0E0E0' },
  orText: { fontSize: 11, color: '#999', fontWeight: '600', marginHorizontal: 10, letterSpacing: 1 },
  fieldLabel: { fontSize: 13, fontWeight: '500', color: '#767676', marginBottom: 8 },
  logoInputRow: { flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, backgroundColor: '#F5F5F5', borderRadius: 6, paddingHorizontal: 14, height: 44, fontSize: 14, color: '#333', borderWidth: 1, borderColor: '#E0E0E0', marginRight: 8 },
  applyBtn: { paddingHorizontal: 16, height: 44, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  applyBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  logoPreview: { flexDirection: 'row', alignItems: 'center', marginTop: 12, backgroundColor: '#F5F5F5', padding: 12, borderRadius: 8 },
  logoPreviewImg: { width: 48, height: 48, borderRadius: 8, marginRight: 12 },
  sizeRow: { flexDirection: 'row' },
  sizeBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 6, backgroundColor: '#F5F5F5', marginHorizontal: 4 },
  sizeBtnText: { fontSize: 14, fontWeight: '600', color: '#333' },
  sizeBtnTextActive: { color: '#FFFFFF' },
  sizePx: { fontSize: 11, color: '#999', marginTop: 2 },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorSwatch: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  colorSwatchActive: { borderWidth: 3, borderColor: '#333333' },
  customColorRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  hexInput: { flex: 1, backgroundColor: '#F5F5F5', borderRadius: 6, paddingHorizontal: 14, height: 40, fontSize: 14, color: '#333', borderWidth: 2, marginHorizontal: 8 },
  hexPreview: { width: 36, height: 36, borderRadius: 18 },
  resetBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', marginHorizontal: 16, padding: 16, borderRadius: 8, borderWidth: 1, borderColor: '#DB0011' },
  resetBtnText: { fontSize: 16, fontWeight: '600', color: '#DB0011', marginLeft: 8 },
  saveAllBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginHorizontal: 16, padding: 16, borderRadius: 10, marginBottom: 12 },
  saveAllBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', marginLeft: 8, letterSpacing: 0.3 },
  helpText: { fontSize: 12, color: '#5E6A7A', marginTop: -4, marginBottom: 12, lineHeight: 17 },
  bankGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  bankCard: { width: '48%', backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#EFF1F4', position: 'relative' },
  bankPreview: { height: 56, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  bankInitialsWrap: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  bankInitials: { fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  bankSwatchRow: { flexDirection: 'row', marginBottom: 8 },
  bankSwatch: { width: 16, height: 16, borderRadius: 8, marginRight: 6 },
  bankName: { fontSize: 13, fontWeight: '700', color: '#0B1424' },
  bankActiveBadge: { position: 'absolute', top: 8, right: 8, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
