import { router } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CAMPAIGN, CARDS, isUnlocked } from '../../hexfort/engine';
import { useHex } from '../../hexfort/state/HexState';
import { Header } from '../../hexfort/ui/Header';
import { CARD_ICON, hx } from '../../hexfort/ui/theme';

export default function Campaign() {
  const insets = useSafeAreaInsets();
  const { save } = useHex();
  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Header title="Campaña" />
      <ScrollView contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 20 }]}>
        {CAMPAIGN.map((m, i) => {
          const open = isUnlocked(save, m.id);
          const won = save.won.includes(m.id);
          const reward = m.reward[0];
          return (
            <Pressable
              key={m.id}
              accessibilityRole="button"
              disabled={!open}
              onPress={() =>
                router.push({
                  pathname: '/hexfort/match/[map]',
                  params: { map: m.id },
                })
              }
              style={[styles.item, !open && { opacity: 0.45 }, won && { borderColor: hx.good }]}
            >
              <View
                style={[
                  styles.num,
                  {
                    backgroundColor: won ? hx.good : open ? hx.gold : hx.faint,
                  },
                ]}
              >
                <Text style={styles.numText}>{open ? (won ? '✓' : i + 1) : '🔒'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{m.name}</Text>
                <Text style={styles.sub}>
                  {m.subtitle} · {m.maxRounds} rondas
                </Text>
              </View>
              {reward && (
                <View style={styles.reward}>
                  <Text style={styles.rewardIcon}>{CARD_ICON[reward]}</Text>
                  <Text style={styles.rewardText} numberOfLines={1}>
                    {won ? 'Conseguida' : CARDS[reward].name}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: hx.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingHorizontal: 10,
  },
  back: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: { color: hx.text, fontSize: 34, marginTop: -4 },
  title: {
    flex: 1,
    textAlign: 'center',
    color: hx.text,
    fontSize: 20,
    fontWeight: '900',
  },
  list: {
    padding: 16,
    gap: 12,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: hx.panel,
    borderRadius: 16,
    padding: 14,
    borderWidth: 2,
    borderColor: hx.border,
  },
  num: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numText: { color: '#2A1E00', fontWeight: '900', fontSize: 18 },
  name: { color: hx.text, fontSize: 17, fontWeight: '800' },
  sub: { color: hx.dim, fontSize: 13, marginTop: 2 },
  reward: { alignItems: 'center', width: 76 },
  rewardIcon: { fontSize: 24 },
  rewardText: { color: hx.gold, fontSize: 10, fontWeight: '700' },
});
