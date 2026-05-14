import React from 'react';
import { TouchableOpacity, StyleSheet, View, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

interface BackButtonProps {
  color?: string;
  size?: number;
  fallbackPath?: string; // route to go to if there's nothing to pop
  style?: any;
}

/**
 * Universal back button used in custom headers across the app.
 *
 * - Tries router.back() first (pops the navigation stack)
 * - If there is no history (e.g. deep-link / web), navigates to `fallbackPath`
 *   which defaults to the Home tab.
 * - Renders the platform-correct chevron (chevron-back is iOS-style,
 *   arrow-back is Android-style); we use chevron-back universally for
 *   visual consistency with the HSBC mobile-banking app.
 */
export default function BackButton({
  color = '#FFFFFF',
  size = 24,
  fallbackPath = '/(tabs)/home',
  style,
}: BackButtonProps) {
  const router = useRouter();

  const handlePress = () => {
    try {
      if (router.canGoBack && router.canGoBack()) {
        router.back();
        return;
      }
    } catch {
      /* ignore */
    }
    // Fallback for deep-links / refresh on web
    router.replace(fallbackPath as any);
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      style={[styles.button, style]}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      testID="back-button"
    >
      <Ionicons name="chevron-back" size={size} color={color} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginLeft: -6, // tighter alignment with header padding
  },
});
