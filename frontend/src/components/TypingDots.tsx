import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';

export default function TypingDots({ color = '#767676' }: { color?: string }) {
  const a1 = useRef(new Animated.Value(0.3)).current;
  const a2 = useRef(new Animated.Value(0.3)).current;
  const a3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animate = (val: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(val, { toValue: 1, duration: 400, delay, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(val, { toValue: 0.3, duration: 400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      );
    const a = animate(a1, 0);
    const b = animate(a2, 150);
    const c = animate(a3, 300);
    a.start();
    b.start();
    c.start();
    return () => {
      a.stop();
      b.stop();
      c.stop();
    };
  }, [a1, a2, a3]);

  return (
    <View style={styles.row}>
      <Animated.View style={[styles.dot, { backgroundColor: color, opacity: a1, transform: [{ scale: a1 }] }]} />
      <Animated.View style={[styles.dot, { backgroundColor: color, opacity: a2, transform: [{ scale: a2 }] }]} />
      <Animated.View style={[styles.dot, { backgroundColor: color, opacity: a3, transform: [{ scale: a3 }] }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 },
  dot: { width: 7, height: 7, borderRadius: 4, marginHorizontal: 2 },
});
