import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { useCustomization } from '../context/CustomizationContext';

interface Props {
  variant?: 'default' | 'small' | 'header';
  tint?: string;
}

export default function AppLogo({ variant = 'default', tint }: Props) {
  const { settings, colors, logoSize } = useCustomization();

  // Resolve effective size based on variant + customization
  let effectiveSize = logoSize;
  if (variant === 'small') effectiveSize = Math.min(logoSize, 28);
  // header variant follows the customized size but is capped so the top bar stays usable
  else if (variant === 'header') effectiveSize = Math.min(logoSize, 80);

  // If custom logo URL is set, show image
  if (settings.logo.url) {
    return (
      <Image
        source={{ uri: settings.logo.url }}
        style={{ width: effectiveSize, height: effectiveSize, borderRadius: effectiveSize / 6 }}
        resizeMode="contain"
        testID="custom-logo"
      />
    );
  }

  // Default HSBC hexagon grid — hexagons sized as half of the effective size each (2x2 grid)
  const baseSize = Math.max(8, Math.floor(effectiveSize / 2.4));
  const color = tint || colors.primary;

  return (
    <View testID="default-logo">
      <View style={styles.row}>
        <View style={[styles.hex, { width: baseSize, height: baseSize, backgroundColor: tint === '#FFFFFF' ? '#FFFFFF' : color }]} />
        <View style={[styles.hex, { width: baseSize, height: baseSize, backgroundColor: 'transparent', borderWidth: 1, borderColor: tint === '#FFFFFF' ? '#FFFFFF' : color }]} />
      </View>
      <View style={styles.row}>
        <View style={[styles.hex, { width: baseSize, height: baseSize, backgroundColor: 'transparent', borderWidth: 1, borderColor: tint === '#FFFFFF' ? '#FFFFFF' : color }]} />
        <View style={[styles.hex, { width: baseSize, height: baseSize, backgroundColor: tint === '#FFFFFF' ? '#FFFFFF' : color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  hex: { margin: 0.5 },
});
