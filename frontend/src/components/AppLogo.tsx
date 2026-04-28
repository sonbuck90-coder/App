import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { useCustomization } from '../context/CustomizationContext';

interface Props {
  variant?: 'default' | 'small' | 'header';
  tint?: string;
}

export default function AppLogo({ variant = 'default', tint }: Props) {
  const { settings, colors, logoSize } = useCustomization();

  // If custom logo URL is set, show image
  if (settings.logo.url) {
    const size = variant === 'header' ? 30 : variant === 'small' ? 24 : logoSize;
    return (
      <Image
        source={{ uri: settings.logo.url }}
        style={{ width: size, height: size, borderRadius: size / 4 }}
        resizeMode="contain"
        testID="custom-logo"
      />
    );
  }

  // Default HSBC hexagon grid
  const baseSize = variant === 'header' ? 14 : variant === 'small' ? 10 : logoSize / 3;
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
