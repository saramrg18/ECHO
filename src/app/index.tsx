import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CAMPAIGN, SKIRMISH, STARTER_DECK, aiDeckFor, createMatch, isUnlocked } from '../hexfort/engine';
import { useHex } from '../hexfort/state/HexState';
import { Board3D } from '../hexfort/three/Board3D';
import { HxButton } from '../hexfort/ui/HxButton';
import { hx } from '../hexfort/ui/theme';

const noop = () => {};

export default function Home() {
  const insets = useSafeAreaInsets();
  const { save, ready } = useHex();
  const preview = useMemo(
    () =>
      createMatch({
        map: SKIRMISH,
        playerDeck: STARTER_DECK,
        aiDeck: aiDeckFor(SKIRMISH),
        seed: 3,
      }),
    [],
  );
  const next =
    CAMPAIGN.find((m) => isUnlocked(save, m.id) && !save.won.includes(m.id)) ?? CAMPAIGN[CAMPAIGN.length - 1];

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }]}>
      <View style={styles.preview}>
        <Board3D state={preview} highlights={{}} fx={[]} onTap={noop} showZoom={false} showcase />
        <View style={styles.titleWrap} pointerEvents="none">
          <Text style={styles.title}>HEXFORT</Text>
          <Text style={styles.subtitle}>Conquista · Construye · Combina</Text>
        </View>
      </View>
      <View style={styles.menu}>
        <Text style={styles.progress}>
          Campaña: {save.won.length}/{CAMPAIGN.length} mapas
        </Text>
        <HxButton
          label={save.won.length === 0 ? 'Jugar' : `Jugar · ${next.name}`}
          variant="gold"
          disabled={!ready}
          onPress={() =>
            router.push({
              pathname: '/hexfort/match/[map]',
              params: { map: next.id },
            })
          }
        />
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <HxButton label="Campaña" onPress={() => router.push('/hexfort/campaign')} />
          </View>
          <View style={{ flex: 1 }}>
            <HxButton label="Mi mazo" onPress={() => router.push('/hexfort/deck')} />
          </View>
        </View>
        <HxButton
          label="Partida rápida"
          onPress={() =>
            router.push({
              pathname: '/hexfort/match/[map]',
              params: { map: SKIRMISH.id },
            })
          }
        />
        <Pressable onPress={() => router.push('/echo')} style={styles.echo} accessibilityRole="button">
          <Text style={styles.echoText}>Jugar a ECHO (juego anterior)</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: hx.bg },
  preview: { flex: 1, minHeight: 260 },
  titleWrap: {
    position: 'absolute',
    top: 18,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 46,
    fontWeight: '900',
    letterSpacing: 4,
    textShadowColor: 'rgba(10,30,60,0.6)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 6,
  },
  subtitle: {
    color: '#0E2A4A',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 1.5,
  },
  menu: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  progress: { color: hx.dim, textAlign: 'center', fontWeight: '700' },
  row: { flexDirection: 'row', gap: 12 },
  echo: { alignItems: 'center', paddingVertical: 8 },
  echoText: { color: hx.faint, fontSize: 13, textDecorationLine: 'underline' },
});
