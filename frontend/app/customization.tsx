import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCustomization, HSBC_DEFAULTS, LOGO_SIZES } from '../src/context/CustomizationContext';
import AppLogo from '../src/components/AppLogo';

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

const ACCENT_COLORS = [
  { label: 'Teal', value: '#00847F' },
  { label: 'Gold', value: '#C4A86C' },
  { label: 'Coral', value: '#FF6B6B' },
  { label: 'Sky Blue', value: '#4FC3F7' },
  { label: 'Lime', value: '#8BC34A' },
  { label: 'Pink', value: '#E91E63' },
];

const SIZE_OPTIONS: Array<{ label: string; value: 'small' | 'medium' | 'large' | 'xlarge' }> = [
  { label: 'Small', value: 'small' },
  { label: 'Medium', value: 'medium' },
  { label: 'Large', value: 'large' },
  { label: 'X-Large', value: 'xlarge' },
];

export default function CustomizationScreen() {
  const router = useRouter();
  const { settings, colors, updateColors, updateLogo, resetToDefaults, isCustomized } = useCustomization();
  const [logoUrl, setLogoUrl] = useState(settings.logo.url);

  const handleLogoUrlSave = () => {
    updateLogo({ url: logoUrl.trim() });
    if (logoUrl.trim()) {
      Alert.alert('Logo Updated', 'Your custom logo has been applied');
    } else {
      Alert.alert('Logo Reset', 'Default logo restored');
    }
  };

  const handleReset = () => {
    Alert.alert('Reset to Defaults', 'This will restore all colors and logo to HSBC defaults.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: () => { resetToDefaults(); setLogoUrl(''); Alert.alert('Done', 'Settings restored to HSBC defaults'); } },
    ]);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#F5F5F5' }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="back-btn">
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Customization</Text>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Preview */}
        <View style={styles.previewCard}>
          <Text style={styles.previewLabel}>Live Preview</Text>
          <View style={[styles.previewBar, { backgroundColor: colors.primary }]}>
            <AppLogo variant="header" tint="#FFFFFF" />
            <Text style={styles.previewTitle}>HSBC Mobile Banking</Text>
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

        {/* Logo Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Logo</Text>
          <View style={styles.card}>
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

        {/* Reset */}
        {isCustomized && (
          <TouchableOpacity style={styles.resetBtn} onPress={handleReset} testID="reset-defaults-btn">
            <Ionicons name="refresh" size={20} color="#DB0011" />
            <Text style={styles.resetBtnText}>Reset to HSBC Defaults</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
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
  previewBar: { flexDirection: 'row', alignItems: 'center', padding: 14, marginTop: 8 },
  previewTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', marginLeft: 12 },
  previewContent: { padding: 12, flexDirection: 'row', alignItems: 'center' },
  previewBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 6, marginRight: 12 },
  previewBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  previewAccent: { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 8 },
  previewAccentDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  previewAccentText: { fontSize: 13, fontWeight: '600' },
  section: { marginHorizontal: 16, marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#333333', marginBottom: 10 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 8, padding: 16 },
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
});
