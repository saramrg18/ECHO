import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LEVEL_ORDER, TOTAL_STARS, levelNumber, levelStars } from '../levels';
import { completedCount, continueLevel } from '../progress/progress';
import { useAppState } from '../state/AppState';
import { Button } from '../ui/components/Button';
import { Logo } from '../ui/components/Logo';
import { Screen } from '../ui/components/Screen';
import { colors } from '../ui/theme';

export default function Home() {
  const { progress, ready } = useAppState();
  const done = completedCount(progress);
  const total = LEVEL_ORDER.length;
  const next = continueLevel(progress, LEVEL_ORDER);
  const stars = Object.entries(progress.completed).reduce((s, [id, r]) => s + levelStars(id, r.bestMoves), 0);
  const started = done > 0 || progress.lastPlayed !== undefined;

  return (
    <Screen>
      <View style={styles.center}>
        <Logo size={68} />
        <Text style={styles.tagline}>Cada movimiento vuelve.</Text>
      </View>

      <View style={styles.bottom}>
        <View style={styles.progress} accessibilityLabel={`Progreso: ${done} de ${total} niveles`}>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>Progreso</Text>
            <Text style={styles.progressValue}>
              {done} <Text style={{ color: colors.textFaint }}>/ {total} niveles</Text>
              {'   '}
              <Text style={{ color: colors.player }}>★</Text> {stars} <Text style={{ color: colors.textFaint }}>/ {TOTAL_STARS}</Text>
            </Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${(done / total) * 100}%` }]} />
          </View>
        </View>

        <Button
          variant="primary"
          label={started ? `Jugar · Nivel ${levelNumber(next)}` : 'Jugar'}
          disabled={!ready}
          onPress={() => router.push({ pathname: '/play/[id]', params: { id: next } })}
        />
        <Button label="Niveles" onPress={() => router.push('/levels')} />
        <Button label="Ajustes" variant="ghost" onPress={() => router.push('/settings')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 },
  tagline: { color: colors.textDim, fontSize: 15, letterSpacing: 2 },
  bottom: { paddingHorizontal: 24, gap: 12, paddingBottom: 12, width: '100%', maxWidth: 480, alignSelf: 'center' },
  progress: { marginBottom: 16, gap: 10 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  progressLabel: { color: colors.textDim, fontSize: 13, letterSpacing: 1.5, textTransform: 'uppercase' },
  progressValue: { color: colors.text, fontSize: 16, fontWeight: '600', fontVariant: ['tabular-nums'] },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.surfaceHigh, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2, backgroundColor: colors.echo },
});
