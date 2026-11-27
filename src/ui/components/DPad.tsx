import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { Direction } from '../../engine';
import { colors } from '../theme';
import { Arrow } from './Icon';
import { Tap } from './Pressable';

const LABEL: Record<Direction, string> = { up: 'Arriba', down: 'Abajo', left: 'Izquierda', right: 'Derecha' };

export function DPad({ onPress, size = 60, disabled }: { onPress: (d: Direction) => void; size?: number; disabled?: boolean }) {
  const btn = (d: Direction) => (
    <Tap
      accessibilityRole="button"
      accessibilityLabel={LABEL[d]}
      disabled={disabled}
      onPress={() => onPress(d)}
      style={[styles.btn, { width: size, height: size, borderRadius: size * 0.3 }]}
      hitSlop={6}
    >
      <Arrow dir={d} size={size * 0.36} color={colors.text} />
    </Tap>
  );
  return (
    <View style={{ alignItems: 'center', gap: 6 }}>
      {btn('up')}
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {btn('left')}
        <View style={{ width: size, height: size }} />
        {btn('right')}
      </View>
      {btn('down')}
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
