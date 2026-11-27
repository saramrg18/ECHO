import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { Direction } from '../../engine';
import { colors } from '../theme';
import { Arrow } from './Icon';
import { Tap } from './Pressable';

const LABEL: Record<Direction, string> = { up: 'Arriba', down: 'Abajo', left: 'Izquierda', right: 'Derecha' };

export function DPad({
  onPress,
  onPreview,
  highlight,
  size = 60,
  disabled,
}: {
  onPress: (d: Direction) => void;
  /** Called with the direction while a button is held or hovered, null when released. */
  onPreview?: (d: Direction | null) => void;
  /** Direction to highlight (hint). */
  highlight?: Direction;
  size?: number;
  disabled?: boolean;
}) {
  const btn = (d: Direction) => (
    <Tap
      accessibilityRole="button"
      accessibilityLabel={LABEL[d]}
      disabled={disabled}
      onPress={() => onPress(d)}
      onPressIn={() => onPreview?.(d)}
      onPressOut={() => onPreview?.(null)}
      onHoverIn={() => onPreview?.(d)}
      onHoverOut={() => onPreview?.(null)}
      style={[
        styles.btn,
        { width: size, height: size, borderRadius: size * 0.3 },
        highlight === d && { borderColor: colors.player, backgroundColor: 'rgba(255,138,61,0.12)' },
      ]}
      hitSlop={6}
    >
      <Arrow dir={d} size={size * 0.36} color={highlight === d ? colors.player : colors.text} />
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
