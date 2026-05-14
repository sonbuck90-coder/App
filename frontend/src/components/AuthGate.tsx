/**
 * AuthGate — confirms a sensitive action (transfer / payment) with the
 * user's Face ID / Touch ID, or any 4-digit passcode.
 *
 * Usage:
 *   const gate = useAuthGate();
 *   ...
 *   const ok = await gate.confirm({ title: 'Confirm transfer', subtitle: '...' });
 *   if (!ok) return;
 *   // proceed with the transaction
 *
 *   // somewhere in the JSX:
 *   <gate.Render />
 */
import React, { useCallback, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { useCustomization } from '../context/CustomizationContext';

interface ConfirmOptions {
  title?: string;
  subtitle?: string;
}

export function useAuthGate() {
  const { colors } = useCustomization();
  const [visible, setVisible] = useState(false);
  const [title, setTitle] = useState('Confirm transaction');
  const [subtitle, setSubtitle] = useState('Authenticate to authorise this payment.');
  const [passcode, setPasscode] = useState('');
  const [showPasscodePad, setShowPasscodePad] = useState(false);
  const [bioBusy, setBioBusy] = useState(false);
  const [error, setError] = useState('');
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const settle = useCallback((ok: boolean) => {
    setVisible(false);
    setPasscode('');
    setShowPasscodePad(false);
    setError('');
    setBioBusy(false);
    const r = resolver.current;
    resolver.current = null;
    if (r) r(ok);
  }, []);

  const tryBiometric = useCallback(async () => {
    if (Platform.OS === 'web') {
      // No biometrics on web — fall back to passcode immediately.
      setShowPasscodePad(true);
      return;
    }
    try {
      setBioBusy(true);
      const has = await LocalAuthentication.hasHardwareAsync();
      const enrolled = has && (await LocalAuthentication.isEnrolledAsync());
      if (!enrolled) {
        setShowPasscodePad(true);
        return;
      }
      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: title,
        cancelLabel: 'Use passcode',
        fallbackLabel: 'Use passcode',
        disableDeviceFallback: true,
      });
      if (res.success) {
        settle(true);
      } else {
        // Cancelled or failed → offer passcode
        setShowPasscodePad(true);
      }
    } catch {
      setShowPasscodePad(true);
    } finally {
      setBioBusy(false);
    }
  }, [settle, title]);

  const confirm = useCallback(
    async (opts?: ConfirmOptions): Promise<boolean> => {
      setTitle(opts?.title || 'Confirm transaction');
      setSubtitle(opts?.subtitle || 'Authenticate to authorise this payment.');
      setPasscode('');
      setError('');
      setShowPasscodePad(false);
      setVisible(true);
      const p = new Promise<boolean>((resolve) => {
        resolver.current = resolve;
      });
      // Kick off biometric automatically once the modal is on screen.
      // On native this will surface Face ID immediately.
      setTimeout(() => {
        tryBiometric();
      }, 200);
      return p;
    },
    [tryBiometric],
  );

  const handleDigit = (d: string) => {
    if (passcode.length >= 4) return;
    const next = passcode + d;
    setPasscode(next);
    setError('');
    if (next.length === 4) {
      // Accept any 4 digits, just like the login screen.
      setTimeout(() => settle(true), 150);
    }
  };

  const handleDelete = () => {
    setPasscode((p) => p.slice(0, -1));
    setError('');
  };

  const Render = useCallback(
    () => (
      <Modal
        transparent
        visible={visible}
        animationType="fade"
        onRequestClose={() => settle(false)}
      >
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={[styles.iconWrap, { backgroundColor: `${colors.primary}15` }]}>
              <Ionicons
                name={showPasscodePad ? 'keypad' : Platform.OS === 'ios' ? 'happy' : 'finger-print'}
                size={28}
                color={colors.primary}
              />
            </View>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>

            {!showPasscodePad ? (
              <View style={styles.bioBody}>
                {bioBusy ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <Text style={styles.bioHint}>
                    {Platform.OS === 'web'
                      ? 'Enter your 4-digit passcode to confirm.'
                      : 'Look at the camera or place your finger on the sensor.'}
                  </Text>
                )}
                <View style={styles.row}>
                  <TouchableOpacity style={styles.secondaryBtn} onPress={() => setShowPasscodePad(true)}>
                    <Text style={styles.secondaryText}>Use passcode</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => settle(false)}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
                {Platform.OS !== 'web' && !bioBusy && (
                  <TouchableOpacity
                    style={[styles.retryBtn, { backgroundColor: colors.primary }]}
                    onPress={tryBiometric}
                  >
                    <Ionicons name="finger-print" size={18} color="#fff" />
                    <Text style={styles.retryText}>Try Face ID / Touch ID again</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View style={styles.padBody}>
                <View style={styles.dotsRow}>
                  {[0, 1, 2, 3].map((i) => (
                    <View
                      key={i}
                      style={[
                        styles.dot,
                        { borderColor: colors.primary },
                        i < passcode.length && { backgroundColor: colors.primary },
                      ]}
                    />
                  ))}
                </View>
                {error ? <Text style={styles.errorText}>{error}</Text> : null}
                <View style={styles.keypad}>
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                    <TouchableOpacity key={d} style={styles.key} onPress={() => handleDigit(d)}>
                      <Text style={styles.keyText}>{d}</Text>
                    </TouchableOpacity>
                  ))}
                  <View style={styles.key} />
                  <TouchableOpacity style={styles.key} onPress={() => handleDigit('0')}>
                    <Text style={styles.keyText}>0</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.key} onPress={handleDelete}>
                    <Ionicons name="backspace-outline" size={22} color="#0B1424" />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => settle(false)}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    ),
    [
      visible,
      title,
      subtitle,
      showPasscodePad,
      bioBusy,
      passcode,
      error,
      colors.primary,
      settle,
      tryBiometric,
    ],
  );

  return { confirm, Render };
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  sheet: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0B1424',
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#5E6A7A',
    textAlign: 'center',
    marginBottom: 18,
    lineHeight: 18,
  },
  bioBody: { width: '100%', alignItems: 'center' },
  bioHint: { fontSize: 13, color: '#5E6A7A', textAlign: 'center', marginVertical: 16 },
  row: { flexDirection: 'row', gap: 12, marginTop: 4 },
  secondaryBtn: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: '#D5D9DF' },
  secondaryText: { fontSize: 14, fontWeight: '600', color: '#0B1424' },
  cancelBtn: { paddingVertical: 12, paddingHorizontal: 16, marginTop: 6 },
  cancelText: { fontSize: 14, fontWeight: '600', color: '#8893A3' },
  retryBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 18, borderRadius: 8, marginTop: 14 },
  retryText: { color: '#fff', fontSize: 14, fontWeight: '600', marginLeft: 8 },
  padBody: { width: '100%', alignItems: 'center' },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', marginVertical: 14 },
  dot: { width: 14, height: 14, borderRadius: 7, marginHorizontal: 8, borderWidth: 1.5 },
  errorText: { color: '#DB0011', fontSize: 13, marginBottom: 8 },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 280,
  },
  key: {
    width: '30%',
    aspectRatio: 1.4,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 5,
  },
  keyText: { fontSize: 22, fontWeight: '600', color: '#0B1424' },
});
