import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius } from '../theme';
import { Tap } from './Pressable';

type Variant = 'primary' | 'secondary' | 'ghost';

export function Button({
  label,
  onPress,
  variant = 'secondary',
  style,
  disabled,
  icon,
  accessibilityLabel,
}: {
  label?: string;
  onPress: () => void;
  variant?: Variant;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  icon?: React.ReactNode;
  accessibilityLabel?: string;
}) {
  return (
    <Tap
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      disabled={disabled}
      style={[styles.base, styles[variant], !label && styles.iconOnly, style]}
    >
      <View style={styles.row}>
        {icon}
        {label ? <Text style={[styles.label, variant === 'primary' && styles.labelPrimary]}>{label}</Text> : null}
      </View>
    </Tap>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    paddingHorizontal: 22,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconOnly: { paddingHorizontal: 0, width: 52, minHeight: 52 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  primary: {
    backgroundColor: colors.player,
    shadowColor: colors.player,
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  ghost: { backgroundColor: 'transparent' },
  label: { color: colors.text, fontSize: 16, fontWeight: '600', letterSpacing: 0.6 },
  labelPrimary: { color: '#1A0E05' },
});
