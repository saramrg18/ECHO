import { router } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { WORLDS, levelNumber, levelStars } from '../levels';
import { isUnlocked } from '../progress/progress';
import { useAppState } from '../state/AppState';
import { LockIcon } from '../ui/components/Icon';
import { StarRow } from '../ui/components/Stars';
import { Tap } from '../ui/components/Pressable';
import { Screen, TopBar } from '../ui/components/Screen';
import { colors, radius } from '../ui/theme';

export default function Levels() {
  const { progress } = useAppState();
  return (
    <Screen>
      <TopBar title="Niveles" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>
        {WORLDS.map((w, wi) => {
          const done = w.levels.filter((l) => progress.completed[l.id]).length;
          return (
            <View key={w.id} style={styles.world}>
              <View style={styles.worldHead}>
                <Text style={styles.worldIndex}>Bloque {wi + 1}</Text>
                <Text style={styles.worldCount}>
                  {done}/{w.levels.length}
                </Text>
              </View>
              <Text style={styles.worldTitle}>{w.title}</Text>
              <Text style={styles.worldSub}>{w.subtitle}</Text>
              <View style={styles.grid}>
                {w.levels.map((l) => {
                  const unlocked = isUnlocked(progress, l.id);
                  const rec = progress.completed[l.id];
                  const n = levelNumber(l.id);
                  return (
                    <Tap
                      key={l.id}
                      accessibilityRole="button"
                      accessibilityLabel={
                        unlocked
                          ? `Nivel ${n}${rec ? `, completado en ${rec.bestMoves} movimientos, ${levelStars(l.id, rec.bestMoves)} estrellas` : ''}`
                          : `Nivel ${n}, bloqueado`
                      }
                      disabled={!unlocked}
                      onPress={() => router.push({ pathname: '/play/[id]', params: { id: l.id } })}
                      style={[styles.cell, rec && styles.cellDone, !unlocked && styles.cellLocked]}
                    >
                      {unlocked ? (
                        <>
                          <Text style={[styles.num, rec && { color: colors.text }]}>{n}</Text>
                          {rec ? (
                            <View style={styles.metaCol}>
                              <StarRow stars={levelStars(l.id, rec.bestMoves)} size={10} />
                              <Text style={styles.moves}>{rec.bestMoves} mov.</Text>
                            </View>
                          ) : (
                            <View style={styles.meta}>
                              <View style={styles.dot} />
                            </View>
                          )}
                        </>
                      ) : (
                        <LockIcon size={14} color={colors.textFaint} />
                      )}
                    </Tap>
                  );
                })}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 28, width: '100%', maxWidth: 520, alignSelf: 'center' },
  world: { gap: 4 },
  worldHead: { flexDirection: 'row', justifyContent: 'space-between' },
  worldIndex: { color: colors.echo, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', fontWeight: '600' },
  worldCount: { color: colors.textDim, fontSize: 13, fontVariant: ['tabular-nums'] },
  worldTitle: { color: colors.text, fontSize: 22, fontWeight: '700', marginTop: 2 },
  worldSub: { color: colors.textDim, fontSize: 14, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cell: {
    width: 58,
    height: 72,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  cellDone: { borderColor: 'rgba(92,255,176,0.35)' },
  cellLocked: { backgroundColor: colors.bgElevated, borderColor: colors.bgElevated },
  num: { color: colors.textDim, fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
  metaCol: { alignItems: 'center', gap: 1 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 12 },
  moves: { color: colors.textFaint, fontSize: 10, fontVariant: ['tabular-nums'] },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.player },
});
