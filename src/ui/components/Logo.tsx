import React, { useEffect, useState } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import { colors } from '../theme';

/** "ECHO" wordmark with trailing cyan echoes. */
export function Logo({ size = 64 }: { size?: number }) {
  const t = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [t]);
  const style = { fontSize: size, fontWeight: '800' as const, letterSpacing: size * 0.18 };
  const echo = (i: number) => (
    <Animated.Text
      key={i}
      style={[
        style,
        {
          position: 'absolute',
          color: colors.echo,
          opacity: (0.32 / i) as unknown as number,
          transform: [{ translateX: t.interpolate({ inputRange: [0, 1], outputRange: [size * 0.05 * i, size * 0.11 * i] }) }],
        },
      ]}
    >
      ECHO
    </Animated.Text>
  );
  return (
    <View accessibilityRole="header" accessibilityLabel="ECHO" style={{ alignItems: 'flex-start' }}>
      {[2, 1].map(echo)}
      <Text style={[style, { color: colors.text }]}>ECHO</Text>
      <View style={{ position: 'absolute', left: -size * 0.28, top: size * 0.5, width: size * 0.14, height: size * 0.14, borderRadius: 3, backgroundColor: colors.player }} />
    </View>
  );
}
