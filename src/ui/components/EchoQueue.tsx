import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { UpcomingEcho } from '../../engine';
import { colors, radius } from '../theme';
import { Arrow } from './Icon';

/** Shows the moves that will repeat in the next `delay` turns. */
export function EchoQueue({ upcoming, delay }: { upcoming: readonly UpcomingEcho[]; delay: number }) {
  const slots = Array.from({ length: delay }, (_, i) => upcoming.find((e) => e.turnsUntil === i + 1));
  return (
    <View
      style={styles.wrap}
      accessibilityLabel={`Próximos ecos: ${slots.map((s) => (s ? s.dir : 'ninguno')).join(', ')}`}
    >
      <Text style={styles.label}>Próximos ecos</Text>
      <View style={styles.row}>
        {slots.map((s, i) => (
          <View key={i} style={[styles.slot, i === 0 && s && styles.slotNext]}>
            {s ? (
              <Arrow dir={s.dir} size={16} color={i === 0 ? colors.echo : 'rgba(45,226,255,0.55)'} />
            ) : (
              <View style={styles.empty} />
            )}
            <Text style={[styles.when, i === 0 && s && { color: colors.echo }]}>+{i + 1}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'flex-end', gap: 6 },
  label: { color: colors.textFaint, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase' },
  row: { flexDirection: 'row', gap: 6 },
  slot: {
    width: 38,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  slotNext: { borderColor: colors.echo, backgroundColor: 'rgba(45,226,255,0.08)' },
  empty: { width: 10, height: 2, borderRadius: 1, backgroundColor: colors.textFaint },
  when: { color: colors.textFaint, fontSize: 10, fontVariant: ['tabular-nums'] },
});
