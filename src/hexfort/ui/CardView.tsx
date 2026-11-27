import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CARDS, type CardId } from '../engine';
import { CARD_ICON, hx } from './theme';

export function CardView({
  id,
  onPress,
  selected,
  disabled,
  compact,
  badge,
}: {
  id: CardId;
  onPress?: () => void;
  selected?: boolean;
  disabled?: boolean;
  compact?: boolean;
  badge?: string;
}) {
  const def = CARDS[id];
  const accent = def.kind === 'tower' ? hx.tower : hx.spell;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${def.name}, coste ${def.cost}. ${def.text}`}
      onPress={onPress}
      style={[
        styles.card,
        compact && styles.compact,
        { borderColor: selected ? hx.gold : accent },
        selected && styles.selected,
        disabled && styles.disabled,
      ]}
    >
      <View style={[styles.cost, { backgroundColor: hx.energy }]}>
        <Text style={styles.costText}>{def.cost}</Text>
      </View>
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
      <View style={[styles.art, { backgroundColor: accent + '33' }]}>
        <Text style={styles.icon}>{CARD_ICON[id]}</Text>
      </View>
      <Text style={styles.name} numberOfLines={2}>
        {def.name}
      </Text>
      {!compact && (
        <Text style={styles.text} numberOfLines={4}>
          {def.text}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 96,
    height: 138,
    borderRadius: 12,
    borderWidth: 2,
    backgroundColor: hx.panel,
    padding: 6,
    alignItems: 'center',
  },
  compact: { width: 74, height: 100 },
  selected: { transform: [{ translateY: -10 }], backgroundColor: hx.panelHigh },
  disabled: { opacity: 0.45 },
  cost: {
    position: 'absolute',
    top: -8,
    left: -8,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    zIndex: 2,
  },
  costText: { color: '#fff', fontWeight: '900', fontSize: 14 },
  badge: {
    position: 'absolute',
    top: -8,
    right: -8,
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: hx.gold,
    zIndex: 2,
  },
  badgeText: { color: '#3A2A00', fontWeight: '900', fontSize: 12 },
  art: {
    width: '100%',
    height: 46,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  icon: { fontSize: 28 },
  name: {
    color: hx.text,
    fontWeight: '800',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
  },
  text: {
    color: hx.dim,
    fontSize: 9.5,
    textAlign: 'center',
    marginTop: 2,
    lineHeight: 12,
  },
});
