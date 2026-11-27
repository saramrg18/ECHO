import React, { useEffect, useState } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import { MAX_STARS } from '../../engine';
import { colors } from '../theme';

export function StarRow({ stars, size = 12, animated = false }: { stars: number; size?: number; animated?: boolean }) {
  const [vals] = useState(() => Array.from({ length: MAX_STARS }, () => new Animated.Value(animated ? 0 : 1)));
  useEffect(() => {
    if (!animated) return;
    Animated.stagger(
      160,
      vals.map((v) => Animated.timing(v, { toValue: 1, duration: 320, easing: Easing.out(Easing.back(2.2)), useNativeDriver: true })),
    ).start();
  }, [animated, vals]);
  return (
    <View
      style={{ flexDirection: 'row', gap: size * 0.2 }}
      accessibilityLabel={`${stars} de ${MAX_STARS} estrellas`}
    >
      {vals.map((v, i) => (
        <Animated.View key={i} style={{ opacity: v, transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }] }}>
          <Text
            style={{
              fontSize: size,
              lineHeight: size * 1.15,
              color: i < stars ? colors.player : colors.surfaceHigh,
              textShadowColor: i < stars ? colors.playerGlow : 'transparent',
              textShadowRadius: size * 0.5,
            }}
          >
            ★
          </Text>
        </Animated.View>
      ))}
    </View>
  );
}
