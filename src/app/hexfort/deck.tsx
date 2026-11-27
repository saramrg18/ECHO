import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ALL_CARDS, CARDS, DECK_SIZE, SYNERGIES, deckError, owned, type CardId } from '../../hexfort/engine';
import { useHex } from '../../hexfort/state/HexState';
import { CardView } from '../../hexfort/ui/CardView';
import { hx } from '../../hexfort/ui/theme';
import { Header } from '../../hexfort/ui/Header';

export default function Deck() {
  const insets = useSafeAreaInsets();
  const { save, setDeck } = useHex();
  const [deck, setLocal] = useState<CardId[]>(save.deck);
  const error = deckError(deck, save.collection);

  const update = (next: CardId[]) => {
    const sorted = next.slice().sort((a, b) => CARDS[a].cost - CARDS[b].cost || a.localeCompare(b));
    setLocal(sorted);
    if (deckError(sorted, save.collection) === null) setDeck(sorted);
  };
  const count = (id: CardId) => deck.filter((c) => c === id).length;
  const add = (id: CardId) => {
    if (deck.length >= DECK_SIZE || count(id) >= owned(save, id)) return;
    update([...deck, id]);
  };
  const remove = (index: number) => update(deck.filter((_, i) => i !== index));

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Header title="Mi mazo" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <Text style={styles.section}>
          Mazo {deck.length}/{DECK_SIZE}
          <Text style={styles.hint}> · toca una carta para quitarla</Text>
        </Text>
        <Text style={[styles.status, { color: error ? hx.gold : hx.good }]}>
          {error ?? 'Mazo listo. Se guarda solo.'}
        </Text>
        <View style={styles.grid}>
          {deck.map((c, i) => (
            <CardView key={`${c}-${i}`} id={c} compact onPress={() => remove(i)} />
          ))}
        </View>

        <Text style={styles.section}>
          Colección<Text style={styles.hint}> · toca para añadir</Text>
        </Text>
        <View style={styles.grid}>
          {ALL_CARDS.map((c) => {
            const have = owned(save, c);
            const free = have - count(c);
            return (
              <CardView
                key={c}
                id={c}
                badge={have ? `${free}/${have}` : '🔒'}
                disabled={have === 0 || free <= 0 || deck.length >= DECK_SIZE}
                onPress={() => add(c)}
              />
            );
          })}
        </View>

        <Text style={styles.section}>Sinergias</Text>
        {SYNERGIES.map((s) => (
          <Text key={s.id} style={styles.syn}>
            <Text style={{ color: hx.gold, fontWeight: '800' }}>✨ {s.name}: </Text>
            {s.text}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: hx.bg },
  content: {
    padding: 16,
    gap: 12,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  section: { color: hx.text, fontWeight: '900', fontSize: 17, marginTop: 8 },
  hint: { color: hx.faint, fontWeight: '600', fontSize: 12 },
  status: { fontSize: 13, fontWeight: '700' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    paddingTop: 8,
    paddingLeft: 6,
  },
  syn: { color: hx.dim, fontSize: 13, lineHeight: 19 },
});
