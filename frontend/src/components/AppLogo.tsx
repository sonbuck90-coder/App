import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { useCustomization } from '../context/CustomizationContext';

// Bundled default HSBC UK logo (wide wordmark with red hexagon + "HSBC UK" text)
// Aspect ratio is 960:209 ≈ 4.59
const DEFAULT_LOGO = require('../../assets/images/hsbc-uk-logo.png');
const DEFAULT_ASPECT = 960 / 209;

interface Props {
  variant?: 'default' | 'small' | 'header';
  tint?: string;
}

export default function AppLogo({ variant = 'default' }: Props) {
  const { settings, logoSize } = useCustomization();
  const isCustom = !!settings.logo.url;
  const source = isCustom ? { uri: settings.logo.url } : DEFAULT_LOGO;

  // Resolve a HEIGHT for the logo based on variant
  let height: number;
  if (variant === 'header') {
    // Header bars: cap height so the bar stays usable but honour user's size choice
    height = Math.min(Math.max(28, Math.floor(logoSize * 0.45)), 56);
  } else if (variant === 'small') {
    height = Math.min(logoSize, 36);
  } else {
    height = logoSize;
  }

  // Compute width. Custom logos may be any aspect, but we display them square so they look like an app icon.
  const width = isCustom ? height : Math.round(height * DEFAULT_ASPECT);

  return (
    <Image
      source={source}
      style={[
        styles.image,
        { width, height, borderRadius: isCustom ? Math.floor(height / 6) : 0 },
      ]}
      resizeMode="contain"
      testID={isCustom ? 'custom-logo' : 'default-logo'}
    />
  );
}

const styles = StyleSheet.create({
  image: {},
});
