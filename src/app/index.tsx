import { router } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { STARTER_DECK, aiDeckFor, createBrain, createMatch, currentSea, SEAS, type MatchState } from '../mareas/engine';
import { useMareas } from '../mareas/state/MareasState';
import { Scene3D } from '../mareas/three/Scene3D';
import { Btn } from '../mareas/ui/Btn';
import { RulesPanel } from '../mareas/ui/Rules';
import { mt } from '../mareas/ui/theme';

const demoMatch = (seed: number, nextId = 1): MatchState => {
  const s = createMatch({ sea: 'laguna', playerDeck: STARTER_DECK, aiDeck: aiDeckFor('laguna'), seed, duration: 600 });
  s.nextId = nextId;
  return s;
};

export default function Home() {
  const insets = useSafeAreaInsets();
  const { save, ready } = useMareas();
  const [rules, setRules] = useState(false);
  const demo = useRef<MatchState>(demoMatch(11));
  const brains = useMemo(() => ({ player: createBrain(2), ai: createBrain(2) }), []);
  // Restart the background battle when it ends.
  useEffect(() => {
    const id = setInterval(() => {
      if (demo.current.result) demo.current = demoMatch(Math.floor(Math.random() * 1e6), demo.current.nextId);
    }, 1000);
    return () => clearInterval(id);
  }, []);
  const sea = currentSea(save.shells);
  const next = SEAS.find((s) => s.shells > save.shells);

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }]}>
      <View style={styles.preview}>
        <Scene3D state={demo} sea="laguna" brains={brains} selecting={null} demo />
        <View style={styles.titleWrap} pointerEvents="none">
          <Text style={styles.title}>MAREAS</Text>
          <Text style={styles.subtitle}>Cuando baja, cruzan las criaturas · Cuando sube, zarpan los barcos</Text>
        </View>
      </View>
      <View style={styles.menu}>
        <View style={styles.stats}>
          <Text style={styles.stat}>🌊 {sea.name}</Text>
          <Text style={styles.stat}>🐚 {save.shells}</Text>
          <Text style={styles.stat}>⚪ {save.pearls}</Text>
        </View>
        {next && !next.comingSoon && (
          <Text style={styles.progress}>
            {next.shells - save.shells} conchas para llegar a {next.name}
          </Text>
        )}
        <Btn
          label={save.tutorialDone ? `Jugar en ${sea.name}` : 'Primera partida (guiada)'}
          disabled={!ready}
          onPress={() =>
            router.push({
              pathname: '/mareas/match',
              params: save.tutorialDone ? { sea: sea.id } : { sea: 'laguna', tutorial: '1' },
            })
          }
        />
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Btn label="Mares" variant="sea" onPress={() => router.push('/mareas/seas')} />
          </View>
          <View style={{ flex: 1 }}>
            <Btn label="Mazos" variant="sea" onPress={() => router.push('/mareas/deck')} />
          </View>
        </View>
        <Btn label="Cómo se juega" variant="ghost" onPress={() => setRules(true)} />
        <Pressable onPress={() => router.push('/hexfort')} style={styles.old} accessibilityRole="button">
          <Text style={styles.oldText}>Juegos anteriores: HEXFORT y ECHO</Text>
        </Pressable>
      </View>
      {rules && (
        <View style={styles.overlay}>
          <RulesPanel onClose={() => setRules(false)} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: mt.bg },
  preview: { flex: 1, minHeight: 240 },
  titleWrap: { position: 'absolute', top: 14, left: 16, right: 16, alignItems: 'center' },
  title: {
    color: '#FFFFFF',
    fontSize: 50,
    fontWeight: '900',
    letterSpacing: 6,
    textShadowColor: 'rgba(6,40,70,0.6)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 8,
  },
  subtitle: {
    color: '#073B5C',
    fontWeight: '800',
    fontSize: 13,
    textAlign: 'center',
    backgroundColor: 'rgba(255,255,255,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: 'hidden',
  },
  menu: { paddingHorizontal: 20, paddingTop: 14, gap: 10, width: '100%', maxWidth: 480, alignSelf: 'center' },
  stats: { flexDirection: 'row', justifyContent: 'center', gap: 18 },
  stat: { color: mt.text, fontWeight: '900', fontSize: 16 },
  progress: { color: mt.dim, textAlign: 'center', fontWeight: '700', fontSize: 13 },
  row: { flexDirection: 'row', gap: 10 },
  old: { alignItems: 'center', paddingVertical: 6 },
  oldText: { color: mt.faint, fontSize: 13, textDecorationLine: 'underline' },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(4,14,24,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
});
