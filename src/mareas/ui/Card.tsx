import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { liftTransition } from './motion';
import { CARDS, type CardId } from '../engine';
import { KIND_BADGE, mt } from './theme';

/** A card in the hand or in the collection. */
export function Card({
  id,
  onPress,
  selected,
  energy,
  note,
  level,
  small,
  dim,
}: {
  id: CardId;
  onPress?: () => void;
  selected?: boolean;
  /** Current energy, to show how close the card is to being playable. */
  energy?: number;
  /** Small text under the name, e.g. "Esperará". */
  note?: string | null;
  level?: number;
  small?: boolean;
  dim?: boolean;
}) {
  const c = CARDS[id];
  const badge = KIND_BADGE[c.kind];
  const ready = energy === undefined || energy + 1e-6 >= c.cost;
  const fill = energy === undefined ? 1 : Math.min(1, energy / c.cost);
  const [pressed, setPressed] = useState(false);
  const lift = selected ? -8 : 0;
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole="button"
      accessibilityLabel={`${c.name}, cuesta ${c.cost}`}
      style={styles.touch}
    >
      <Animated.View
        style={[
          styles.card,
          small && styles.small,
          selected && styles.selected,
          (dim || !ready) && styles.dim,
          liftTransition,
          { transform: [{ translateY: lift }, { scale: pressed ? 0.96 : 1 }] },
        ]}
      >
        {!ready ? <View style={[styles.charge, { height: `${fill * 100}%` }]} /> : null}
        <View style={[styles.badge, { backgroundColor: badge.color }]}>
          <Text style={styles.badgeText}>
            {badge.icon} {badge.label}
          </Text>
        </View>
        <Text style={[styles.icon, small && styles.iconSmall]}>{c.icon}</Text>
        <Text style={styles.name} numberOfLines={1}>
          {c.name}
        </Text>
        {note ? (
          <Text style={styles.note}>{note}</Text>
        ) : level ? (
          <Text style={styles.level}>Nivel {level}</Text>
        ) : null}
        <View style={styles.cost}>
          <Text style={styles.costText}>{c.cost}</Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  touch: { flex: 1 },
  card: {
    minHeight: 104,
    borderRadius: 14,
    backgroundColor: mt.panelHigh,
    borderWidth: 2,
    borderColor: mt.border,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 6,
    paddingTop: 22,
    overflow: 'hidden',
  },
  small: { minHeight: 92 },
  selected: { borderColor: '#FFFFFF', backgroundColor: '#2A6496' },
  dim: { opacity: 0.55 },
  charge: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(63,214,232,0.18)' },
  badge: { position: 'absolute', top: 0, left: 0, right: 0, paddingVertical: 2, alignItems: 'center' },
  badgeText: { fontSize: 10, fontWeight: '900', color: '#10202E' },
  icon: { fontSize: 32 },
  iconSmall: { fontSize: 26 },
  name: { color: mt.text, fontWeight: '800', fontSize: 12, marginTop: 2, paddingHorizontal: 2 },
  note: { color: mt.low, fontSize: 9.5, fontWeight: '800' },
  level: { color: mt.dim, fontSize: 10, fontWeight: '700' },
  cost: {
    position: 'absolute',
    top: 18,
    left: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: mt.energy,
    borderWidth: 2,
    borderColor: '#0E4E5E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  costText: { color: '#06323C', fontWeight: '900', fontSize: 13 },
});
