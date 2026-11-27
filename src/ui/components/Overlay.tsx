import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { colors, radius } from '../theme';

/** Full-screen dimmed overlay with an animated card. */
export function Overlay({ children, accent }: { children: React.ReactNode; accent?: string }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(t, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [t]);
  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: t }]}>
      <Animated.View
        style={[
          styles.card,
          accent ? { borderColor: accent } : null,
          {
            transform: [
              { scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
              { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
            ],
          },
        ]}
      >
        {children}
      </Animated.View>
    </Animated.View>
  );
}

/** Expanding rings used by the victory animation. */
export function VictoryBurst({ color = colors.exit }: { color?: string }) {
  const rings = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
  const core = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(core, { toValue: 1, useNativeDriver: true, speed: 8, bounciness: 12 }),
      ...rings.map((r, i) =>
        Animated.sequence([
          Animated.delay(120 + i * 160),
          Animated.timing(r, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]),
      ),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <View style={{ width: 120, height: 120, alignItems: 'center', justifyContent: 'center' }}>
      {rings.map((r, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            width: 60,
            height: 60,
            borderRadius: 14,
            borderWidth: 2,
            borderColor: i === 1 ? colors.echo : color,
            opacity: r.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.8, 0] }),
            transform: [{ rotate: '45deg' }, { scale: r.interpolate({ inputRange: [0, 1], outputRange: [0.6, 2] }) }],
          }}
        />
      ))}
      <Animated.View
        style={{
          width: 44,
          height: 44,
          borderWidth: 3,
          borderColor: color,
          borderRadius: 6,
          transform: [{ rotate: '45deg' }, { scale: core }],
          shadowColor: color,
          shadowOpacity: 0.8,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 0 },
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(5,7,11,0.78)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    alignItems: 'center',
    gap: 14,
  },
});
