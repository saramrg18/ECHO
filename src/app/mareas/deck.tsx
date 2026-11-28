import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CARDS,
  DECK_SIZE,
  DECK_SLOTS,
  KIND_LABEL,
  MAX_LEVEL,
  SEAS,
  cardLevel,
  deckError,
  unlockedCards,
  upgradeCost,
  type CardId,
} from '../../mareas/engine';
import { useMareas } from '../../mareas/state/MareasState';
import { Btn } from '../../mareas/ui/Btn';
import { Card } from '../../mareas/ui/Card';
import { mt } from '../../mareas/ui/theme';

export default function Decks() {
  const insets = useSafeAreaInsets();
  const { save, setDeck, setActiveDeck, upgrade } = useMareas();
  const [slot, setSlot] = useState(save.activeDeck);
  const [picked, setPicked] = useState<CardId | null>(null);
  const deck = save.decks[slot];
  const owned = unlockedCards(save.shells);
  const locked = SEAS.flatMap((s) => s.cards).filter((c) => !owned.includes(c));
  const error = deckError(save, deck);
  const inDeck = picked ? deck.includes(picked) : false;

  const toggle = () => {
    if (!picked) return;
    if (inDeck)
      setDeck(
        slot,
        deck.filter((c) => c !== picked),
      );
    else if (deck.length < DECK_SIZE) setDeck(slot, [...deck, picked]);
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Btn small variant="ghost" label="‹ Volver" onPress={() => router.back()} />
        <Text style={styles.title}>Mazos</Text>
        <Text style={styles.pearls}>⚪ {save.pearls}</Text>
      </View>
      <View style={styles.tabs}>
        {Array.from({ length: DECK_SLOTS }, (_, i) => (
          <Pressable key={i} onPress={() => setSlot(i)} style={[styles.tab, slot === i && styles.tabOn]}>
            <Text style={styles.tabText}>
              Mazo {i + 1}
              {save.activeDeck === i ? ' ✓' : ''}
            </Text>
          </Pressable>
        ))}
      </View>
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.deckHead}>
          <Text style={styles.section}>
            En el mazo ({deck.length}/{DECK_SIZE})
          </Text>
          {save.activeDeck === slot ? (
            <Text style={styles.active}>Lo usas para jugar</Text>
          ) : (
            <Btn small label="Usar este" disabled={!!error} onPress={() => setActiveDeck(slot)} />
          )}
        </View>
        {error && <Text style={styles.error}>{error}</Text>}
        <Grid cards={deck} picked={picked} onPick={setPicked} levels={(c) => cardLevel(save, c)} />

        {picked && (
          <View style={styles.detail}>
            <Text style={styles.detailTitle}>
              {CARDS[picked].icon} {CARDS[picked].name} · nivel {cardLevel(save, picked)}
            </Text>
            <Text style={styles.detailKind}>
              {KIND_LABEL[CARDS[picked].kind]} · cuesta {CARDS[picked].cost} ⚡
            </Text>
            <Text style={styles.detailText}>{CARDS[picked].text}</Text>
            <View style={styles.detailRow}>
              <View style={{ flex: 1 }}>
                <Btn
                  small
                  variant="sea"
                  label={inDeck ? 'Quitar del mazo' : deck.length >= DECK_SIZE ? 'Mazo lleno' : 'Añadir al mazo'}
                  disabled={!inDeck && deck.length >= DECK_SIZE}
                  onPress={toggle}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Btn
                  small
                  label={
                    cardLevel(save, picked) >= MAX_LEVEL
                      ? 'Nivel máximo'
                      : `Mejorar · ${upgradeCost(cardLevel(save, picked))} ⚪`
                  }
                  disabled={cardLevel(save, picked) >= MAX_LEVEL || save.pearls < upgradeCost(cardLevel(save, picked))}
                  onPress={() => upgrade(picked)}
                />
              </View>
            </View>
            <Text style={styles.detailHint}>Cada nivel da +10% de vida y daño.</Text>
          </View>
        )}

        <Text style={styles.section}>Tus otras cartas</Text>
        <Grid
          cards={owned.filter((c) => !deck.includes(c))}
          picked={picked}
          onPick={setPicked}
          levels={(c) => cardLevel(save, c)}
          empty="Todas tus cartas están en el mazo."
        />
        {locked.length > 0 && (
          <>
            <Text style={styles.section}>Por descubrir</Text>
            <View style={styles.grid}>
              {locked.map((c) => (
                <View key={c} style={styles.cell}>
                  <View style={styles.locked}>
                    <Text style={{ fontSize: 26, opacity: 0.35 }}>{CARDS[c].icon}</Text>
                    <Text style={styles.lockedText}>🔒 {SEAS.find((s) => s.id === CARDS[c].sea)!.name}</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}
        <Text style={styles.more}>Hay más mares en camino con muchas cartas nuevas.</Text>
      </ScrollView>
    </View>
  );
}

function Grid({
  cards,
  picked,
  onPick,
  levels,
  empty,
}: {
  cards: CardId[];
  picked: CardId | null;
  onPick(c: CardId): void;
  levels(c: CardId): number;
  empty?: string;
}) {
  if (!cards.length && empty) return <Text style={styles.empty}>{empty}</Text>;
  return (
    <View style={styles.grid}>
      {cards.map((c) => (
        <View key={c} style={styles.cell}>
          <Card id={c} small selected={picked === c} level={levels(c)} onPress={() => onPick(c)} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: mt.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
  title: { color: mt.text, fontSize: 24, fontWeight: '900' },
  pearls: { color: mt.text, fontWeight: '900', fontSize: 16, width: 80, textAlign: 'right' },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: mt.panel, alignItems: 'center' },
  tabOn: { backgroundColor: mt.panelHigh, borderWidth: 2, borderColor: '#FFFFFF' },
  tabText: { color: mt.text, fontWeight: '900' },
  body: { padding: 16, gap: 12, maxWidth: 520, width: '100%', alignSelf: 'center' },
  deckHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  section: { color: mt.text, fontWeight: '900', fontSize: 16 },
  active: { color: mt.good, fontWeight: '800' },
  error: { color: mt.bad, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  cell: { width: '25%', padding: 4, paddingTop: 10 },
  empty: { color: mt.faint },
  detail: { backgroundColor: mt.panel, borderRadius: 16, padding: 14, gap: 6, borderWidth: 2, borderColor: mt.border },
  detailTitle: { color: mt.text, fontWeight: '900', fontSize: 17 },
  detailKind: { color: mt.low, fontWeight: '800', fontSize: 13 },
  detailText: { color: mt.dim, fontSize: 14 },
  detailRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  detailHint: { color: mt.faint, fontSize: 12 },
  locked: {
    minHeight: 92,
    borderRadius: 14,
    backgroundColor: mt.panel,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  lockedText: { color: mt.faint, fontSize: 10, fontWeight: '800' },
  more: { color: mt.faint, textAlign: 'center', marginTop: 8 },
});
