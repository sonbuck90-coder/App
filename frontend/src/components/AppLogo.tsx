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

  // Resolve a HEIGHT for the logo based on variant. Sizes are chosen so the
  // "Giant" preset (520px) can actually take over the login/header hero area
  // when the user has explicitly opted for a massive logo.
  let height: number;
  if (variant === 'header') {
    // Header bars: keep at least 28px readable but let the user scale it
    // up quite generously — capped at 96 so the top-bar itself doesn't
    // become the entire screen.
    height = Math.min(Math.max(28, Math.floor(logoSize * 0.5)), 96);
  } else if (variant === 'small') {
    // Inline text-adjacent logo, e.g. next to greetings. Scale ~30% of
    // the chosen size but clamp to 72 so it doesn't overwhelm the row.
    height = Math.min(Math.max(24, Math.floor(logoSize * 0.35)), 72);
  } else {
    // Default (hero / login): honour the user's chosen size exactly, no cap.
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
