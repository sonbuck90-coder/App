import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';

const COLORS = { primary: '#DB0011', white: '#FFFFFF', lightGray: '#F5F5F5', gray: '#767676', darkGray: '#333333', black: '#000000' };
const PASSCODE_LENGTH = 4;

export default function LoginScreen() {
  const router = useRouter();
  const { loginWithPasscode } = useAuth();
  const [passcode, setPasscode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const hiddenInputRef = useRef<TextInput>(null);

  const handleDigit = (digit: string) => {
    if (passcode.length >= PASSCODE_LENGTH) return;
    const newPasscode = passcode + digit;
    setPasscode(newPasscode);
    setError('');

    if (newPasscode.length === PASSCODE_LENGTH) {
      handleLogin(newPasscode);
    }
  };

  const handleDelete = () => {
    setPasscode(prev => prev.slice(0, -1));
    setError('');
  };

  const handleLogin = async (code: string) => {
    setIsLoading(true);
    try {
      await loginWithPasscode(code);
      router.replace('/(tabs)/home');
    } catch (err: any) {
      setPasscode('');
      setError('Invalid passcode. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Logo */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <View style={styles.hexagonRow}>
              <View style={[styles.hexagon, styles.hexagonRed]} />
              <View style={[styles.hexagon, styles.hexagonWhite]} />
            </View>
            <View style={styles.hexagonRow}>
              <View style={[styles.hexagon, styles.hexagonWhite]} />
              <View style={[styles.hexagon, styles.hexagonRed]} />
            </View>
          </View>
          <Text style={styles.brandName}>HSBC</Text>
        </View>

        {/* Title */}
        <Text style={styles.title}>Enter your passcode</Text>
        <Text style={styles.subtitle}>Enter your 4-digit security passcode</Text>

        {/* Dots */}
        <View style={styles.dotsContainer}>
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              style={[
                styles.dot,
                passcode.length > i && styles.dotFilled,
                error ? styles.dotError : null,
              ]}
            />
          ))}
        </View>

        {/* Error */}
        {error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={16} color={COLORS.primary} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Loading */}
        {isLoading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
        ) : null}

        {/* Keypad */}
        <View style={styles.keypad}>
          {digits.map((digit, i) => {
            if (digit === '') return <View key={i} style={styles.keyEmpty} />;
            if (digit === 'del') {
              return (
                <TouchableOpacity key={i} style={styles.key} onPress={handleDelete} testID="passcode-delete">
                  <Ionicons name="backspace-outline" size={26} color={COLORS.darkGray} />
                </TouchableOpacity>
              );
            }
            return (
              <TouchableOpacity
                key={i}
                style={styles.key}
                onPress={() => handleDigit(digit)}
                disabled={isLoading}
                testID={`passcode-key-${digit}`}
              >
                <Text style={styles.keyText}>{digit}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Biometric hint */}
        <TouchableOpacity style={styles.biometricHint}>
          <Ionicons name="finger-print" size={20} color={COLORS.primary} />
          <Text style={styles.biometricText}>Use Touch ID</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  content: { flex: 1, alignItems: 'center', paddingHorizontal: 32, paddingTop: 20 },
  header: { alignItems: 'center', marginBottom: 32 },
  logoContainer: { marginBottom: 8 },
  hexagonRow: { flexDirection: 'row' },
  hexagon: { width: 22, height: 22, margin: 1 },
  hexagonRed: { backgroundColor: COLORS.primary },
  hexagonWhite: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.primary },
  brandName: { fontSize: 28, fontWeight: '700', color: COLORS.primary, letterSpacing: 4 },
  title: { fontSize: 22, fontWeight: '600', color: COLORS.darkGray, marginBottom: 8 },
  subtitle: { fontSize: 14, color: COLORS.gray, marginBottom: 32 },
  dotsContainer: { flexDirection: 'row', marginBottom: 24 },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: '#D0D0D0', marginHorizontal: 10 },
  dotFilled: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  dotError: { borderColor: COLORS.primary, backgroundColor: 'transparent' },
  errorContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  errorText: { fontSize: 14, color: COLORS.primary, marginLeft: 6, fontWeight: '500' },
  loader: { marginBottom: 16 },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', width: 280, marginTop: 8 },
  key: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', margin: 8, backgroundColor: COLORS.lightGray },
  keyEmpty: { width: 72, height: 72, margin: 8 },
  keyText: { fontSize: 28, fontWeight: '500', color: COLORS.darkGray },
  biometricHint: { flexDirection: 'row', alignItems: 'center', marginTop: 20 },
  biometricText: { fontSize: 14, color: COLORS.primary, fontWeight: '500', marginLeft: 8 },
});
