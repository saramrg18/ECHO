import React, { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated from 'react-native-reanimated';
import { pressTransition } from './motion';

export function Btn({
  label,
  onPress,
  variant = 'main',
  small,
  disabled,
}: {
  label: string;
  onPress: () => void;
  variant?: 'main' | 'sea' | 'ghost';
  small?: boolean;
  disabled?: boolean;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      disabled={disabled}
      pressRetentionOffset={16}
    >
      <Animated.View
        style={[
          styles.base,
          small && styles.small,
          styles[variant],
          disabled && styles.disabled,
          pressTransition,
          { transform: [{ scale: pressed ? 0.97 : 1 }] },
        ]}
      >
        <Text style={[styles.label, small && styles.labelSmall, variant === 'main' && styles.labelMain]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 54,
    paddingHorizontal: 22,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 4,
  },
  small: { minHeight: 44, paddingHorizontal: 14, borderRadius: 12, borderBottomWidth: 3 },
  main: { backgroundColor: '#FF9F1C', borderColor: '#C46A00' },
  sea: { backgroundColor: '#1F8FD6', borderColor: '#0F5E96' },
  ghost: { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(0,0,0,0.2)' },
  disabled: { opacity: 0.4 },
  label: { color: '#fff', fontWeight: '900', fontSize: 17, letterSpacing: 0.4 },
  labelSmall: { fontSize: 14 },
  labelMain: { color: '#3A2000' },
});
