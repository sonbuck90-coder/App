import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../src/context/AuthContext';
import { CustomizationProvider } from '../src/context/CustomizationContext';

export default function RootLayout() {
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
        </Stack>
      </CustomizationProvider>
    </AuthProvider>
  );
}
