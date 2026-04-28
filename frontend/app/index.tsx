import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';

// HSBC Colors
const COLORS = {
  primary: '#DB0011',
  white: '#FFFFFF',
  gray: '#767676',
};

export default function SplashScreen() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (user) {
        router.replace('/(tabs)/home');
      } else {
        router.replace('/(auth)/login');
      }
    }
  }, [user, isLoading]);

  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <View style={styles.hexagonGrid}>
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
        <Text style={styles.tagline}>Mobile Banking</Text>
      </View>
      <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
  },
  hexagonGrid: {
    marginBottom: 16,
  },
  hexagonRow: {
    flexDirection: 'row',
  },
  hexagon: {
    width: 36,
    height: 36,
    margin: 1,
  },
  hexagonRed: {
    backgroundColor: COLORS.primary,
  },
  hexagonWhite: {
    backgroundColor: COLORS.white,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  brandName: {
    fontSize: 42,
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: 6,
  },
  tagline: {
    fontSize: 14,
    color: COLORS.gray,
    marginTop: 8,
  },
  loader: {
    marginTop: 48,
  },
});
