import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../src/context/AuthContext';
import { CustomizationProvider } from '../src/context/CustomizationContext';
import { ensureNotificationPermission, prewarmNotificationAssets } from '../src/services/notifications';

export default function RootLayout() {
  useEffect(() => {
    // Ask once on app start so the first transaction can already show a banner.
    ensureNotificationPermission().catch(() => undefined);
    // Pre-resolve the active bank's logo so the very first notification can
    // attach it without a download stutter.
    prewarmNotificationAssets().catch(() => undefined);
    // Set a sensible document title + favicon-link description for the web
    // build so the shareable preview URL renders nicely in browser tabs,
    // chat link-previews, and home-screen bookmarks.
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      try {
        document.title = 'HSBC UK · Mobile Banking';
        const setMeta = (name: string, content: string, prop = 'name') => {
          let m = document.querySelector(`meta[${prop}="${name}"]`) as HTMLMetaElement | null;
          if (!m) {
            m = document.createElement('meta');
            m.setAttribute(prop, name);
            document.head.appendChild(m);
          }
          m.setAttribute('content', content);
        };
        const setLink = (rel: string, href: string, extra: Record<string, string> = {}) => {
          let l = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
          if (!l) {
            l = document.createElement('link');
            l.setAttribute('rel', rel);
            document.head.appendChild(l);
          }
          l.setAttribute('href', href);
          Object.entries(extra).forEach(([k, v]) => l!.setAttribute(k, v));
        };
        setMeta(
          'description',
          'HSBC UK Mobile Banking demo — sign in with any 4-digit passcode. Runs entirely offline in your browser.',
        );
        setMeta('theme-color', '#DB0011');
        // Open-graph tags so the link renders a proper preview in WhatsApp,
        // iMessage, Slack, Discord, Twitter, LinkedIn.
        setMeta('og:title', 'HSBC UK · Mobile Banking', 'property');
        setMeta(
          'og:description',
          'Full HSBC UK-style banking demo. Works offline in your browser.',
          'property',
        );
        setMeta('og:type', 'website', 'property');
        setMeta('og:image', '/assets/assets/images/icon.png', 'property');
        // iOS home-screen install (Add to Home Screen) support so the app
        // launches full-screen with the HSBC red hexagon icon and its own
        // status-bar colour.
        setMeta('apple-mobile-web-app-capable', 'yes');
        setMeta('apple-mobile-web-app-status-bar-style', 'black-translucent');
        setMeta('apple-mobile-web-app-title', 'HSBC UK');
        setLink('apple-touch-icon', '/assets/assets/images/icon.png');
        setLink('shortcut icon', '/assets/assets/images/favicon.png');
      } catch {
        /* ignore */
      }
    }
  }, []);

  return (
    <AuthProvider>
      <CustomizationProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="payees" />
          <Stack.Screen name="analytics" />
          <Stack.Screen name="chat" />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="transactions" />
          <Stack.Screen name="customization" />
        <Stack.Screen name="add-money" />
        <Stack.Screen name="move-money" />
        <Stack.Screen name="schedules" />
        <Stack.Screen name="card-details" />
        <Stack.Screen name="personal-details" />
        <Stack.Screen name="transaction-detail" />
        <Stack.Screen name="international-transfer" />
        <Stack.Screen name="incoming-transfer" />
        <Stack.Screen name="statements" />
        </Stack>
      </CustomizationProvider>
    </AuthProvider>
  );
}
