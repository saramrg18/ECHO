import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { hx } from './theme';

export function HxButton({
  label,
  onPress,
  variant = 'blue',
  small,
  disabled,
}: {
  label: string;
  onPress: () => void;
  variant?: 'gold' | 'blue' | 'ghost';
  small?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        small && styles.small,
        styles[variant],
        pressed && { transform: [{ translateY: 2 }] },
        disabled && { opacity: 0.4 },
      ]}
    >
      <Text style={[styles.label, small && styles.labelSmall, variant === 'gold' && styles.labelGold]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 54,
    paddingHorizontal: 22,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 4,
  },
  small: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderBottomWidth: 3,
  },
  gold: { backgroundColor: hx.gold, borderColor: hx.goldDark },
  blue: { backgroundColor: hx.player, borderColor: '#1F4FA8' },
  ghost: { backgroundColor: 'transparent', borderColor: 'transparent' },
  label: { color: '#fff', fontWeight: '900', fontSize: 17, letterSpacing: 0.4 },
  labelSmall: { fontSize: 14 },
  labelGold: { color: '#3A2A00' },
});
