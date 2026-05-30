import React, { useEffect } from 'react';
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
