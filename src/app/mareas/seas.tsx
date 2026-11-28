import { router } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CARDS, SEAS, currentSea, seaReached } from '../../mareas/engine';
import { useMareas } from '../../mareas/state/MareasState';
import { Btn } from '../../mareas/ui/Btn';
import { mt } from '../../mareas/ui/theme';

export default function Seas() {
  const insets = useSafeAreaInsets();
  const { save } = useMareas();
  const here = currentSea(save.shells);
  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Btn small variant="ghost" label="‹ Volver" onPress={() => router.back()} />
        <Text style={styles.title}>Mares</Text>
        <Text style={styles.shells}>🐚 {save.shells}</Text>
      </View>
      <ScrollView contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}>
        {SEAS.map((s, i) => {
          const open = seaReached(save.shells, s.id);
          const isHere = s.id === here.id;
          return (
            <View key={s.id} style={[styles.sea, { borderColor: isHere ? '#FFFFFF' : 'transparent' }]}>
              <View style={[styles.swatch, { backgroundColor: s.colors.water }]}>
                <View style={[styles.island, { backgroundColor: s.colors.sand }]} />
                <Text style={styles.num}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={styles.name}>
                  {s.name} {isHere ? '· estás aquí' : ''}
                </Text>
                <Text style={styles.twist}>{s.twist}</Text>
                {s.cards.length > 0 && (
                  <Text style={styles.cards}>
                    {s.cards.map((c) => CARDS[c].icon).join(' ')} {s.cards.length} cartas
                  </Text>
                )}
                {s.comingSoon ? (
                  <Text style={styles.lock}>🔒 Próximamente · 🐚 {s.shells}</Text>
                ) : !open ? (
                  <Text style={styles.lock}>🔒 Necesitas 🐚 {s.shells}</Text>
                ) : (
                  <View style={{ marginTop: 6 }}>
                    <Btn
                      small
                      label={`Jugar en ${s.name}`}
                      onPress={() => router.push({ pathname: '/mareas/match', params: { sea: s.id } })}
                    />
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: mt.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
  title: { color: mt.text, fontSize: 24, fontWeight: '900' },
  shells: { color: mt.text, fontWeight: '900', fontSize: 16, width: 80, textAlign: 'right' },
  list: { padding: 16, gap: 12, maxWidth: 520, width: '100%', alignSelf: 'center' },
  sea: { flexDirection: 'row', gap: 12, backgroundColor: mt.panel, borderRadius: 16, padding: 12, borderWidth: 2 },
  swatch: { width: 64, height: 64, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  island: { width: 30, height: 18, borderRadius: 9, position: 'absolute', bottom: 10 },
  num: { color: '#FFFFFF', fontWeight: '900', fontSize: 22, position: 'absolute', top: 4 },
  name: { color: mt.text, fontWeight: '900', fontSize: 17 },
  twist: { color: mt.dim, fontSize: 13 },
  cards: { color: mt.text, fontSize: 13 },
  lock: { color: mt.faint, fontWeight: '800', fontSize: 13, marginTop: 4 },
});
