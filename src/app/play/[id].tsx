import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useGame } from '../../game/useGame';
import { getLevel, levelNumber, nextLevelId, worldOf } from '../../levels';
import { useAppState } from '../../state/AppState';
import { Board } from '../../ui/components/Board';
import { Button } from '../../ui/components/Button';
import { DPad } from '../../ui/components/DPad';
import { EchoQueue } from '../../ui/components/EchoQueue';
import { PauseIcon, RestartIcon, UndoIcon } from '../../ui/components/Icon';
import { Overlay, VictoryBurst } from '../../ui/components/Overlay';
import { Screen, TopBar } from '../../ui/components/Screen';
import { SwipeArea } from '../../ui/components/SwipeArea';
import { ToggleRow } from '../../ui/components/Toggle';
import { Tap } from '../../ui/components/Pressable';
import { colors, radius } from '../../ui/theme';
import type { Level } from '../../engine';

export default function PlayRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const level = id ? getLevel(id) : undefined;
  if (!level) {
    return (
      <Screen>
        <TopBar title="Nivel no encontrado" onBack={() => router.replace('/levels')} />
      </Screen>
    );
  }
  return <Game key={level.id} level={level} />;
}

function Game({ level }: { level: Level }) {
  const app = useAppState();
  const { settings, progress } = app;
  const [paused, setPaused] = useState(false);
  const [win, setWin] = useState<{ moves: number; prevBest?: number } | null>(null);
  const bestRef = useRef(progress.completed[level.id]?.bestMoves);
  bestRef.current = progress.completed[level.id]?.bestMoves;

  const game = useGame(level, settings, (moves) => {
    setWin({ moves, prevBest: bestRef.current });
    app.completeLevel(level.id, moves);
  });
  const { state } = game;

  useEffect(() => {
    app.setLastPlayed(level.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level.id]);

  const [area, setArea] = useState({ w: 0, h: 0 });
  const n = levelNumber(level.id);
  const world = worldOf(level.id);
  const next = nextLevelId(level.id);
  const nextEcho = game.upcoming.find((e) => e.turnsUntil === 1)?.dir;
  const playing = state.status === 'playing' && !paused;
  const showHint = Boolean(level.hint) && !win;

  const replay = () => {
    setWin(null);
    game.restart();
  };

  return (
    <Screen>
      <TopBar
        title={`Nivel ${n}`}
        onBack={() => router.back()}
        right={
          <Tap accessibilityRole="button" accessibilityLabel="Pausa" onPress={() => setPaused(true)} style={styles.iconBtn} hitSlop={8}>
            <PauseIcon size={16} color={colors.text} />
          </Tap>
        }
      />
      <Text style={styles.levelName}>
        {level.name}
        {world ? <Text style={{ color: colors.textFaint }}>{`  ·  ${world.title}`}</Text> : null}
      </Text>

      <View style={styles.hud}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Turno</Text>
          <Text style={styles.statValue}>{state.turn}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Movimientos</Text>
          <Text style={[styles.statValue, level.maxMoves !== undefined && level.maxMoves - state.turn <= 2 && { color: colors.player }]}>
            {state.turn}
            {level.maxMoves !== undefined ? <Text style={styles.statMax}> / {level.maxMoves}</Text> : null}
          </Text>
        </View>
        <View style={{ flex: 1 }} />
        <EchoQueue upcoming={game.upcoming} delay={level.echoDelay} />
      </View>

      {showHint ? (
        <View style={styles.hint}>
          <Text style={styles.hintText}>{level.hint}</Text>
        </View>
      ) : null}

      <SwipeArea
        enabled={playing}
        onSwipe={game.move}
        style={styles.boardArea}
        onLayout={(e) => setArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      >
        {area.w > 0 ? (
          <Board
            state={state}
            maxWidth={area.w - 24}
            maxHeight={area.h - 16}
            nextEcho={nextEcho}
            version={game.version}
          />
        ) : null}
      </SwipeArea>

      <View style={styles.controls}>
        <Button
          accessibilityLabel="Deshacer"
          icon={<UndoIcon size={20} color={colors.text} />}
          onPress={game.undo}
          disabled={!game.canUndo || Boolean(win)}
        />
        {settings.showDpad ? <DPad onPress={game.move} disabled={!playing} size={58} /> : <Text style={styles.swipeHint}>Desliza para mover</Text>}
        <Button accessibilityLabel="Reiniciar" icon={<RestartIcon size={20} color={colors.text} />} onPress={game.restart} disabled={state.turn === 0} />
      </View>

      {paused ? (
        <Overlay>
          <Text style={styles.ovTitle}>Pausa</Text>
          <View style={{ alignSelf: 'stretch' }}>
            <ToggleRow label="Sonido" value={settings.sound} onChange={(v) => app.updateSettings({ sound: v })} />
            <ToggleRow label="Vibración" value={settings.haptics} onChange={(v) => app.updateSettings({ haptics: v })} />
          </View>
          <Button variant="primary" label="Continuar" style={styles.full} onPress={() => setPaused(false)} />
          <Button
            label="Reiniciar nivel"
            style={styles.full}
            onPress={() => {
              game.restart();
              setPaused(false);
            }}
          />
          <Button label="Ver niveles" variant="ghost" style={styles.full} onPress={() => router.replace('/levels')} />
        </Overlay>
      ) : null}

      {state.status === 'lost' && !paused ? (
        <Overlay accent={colors.player}>
          <Text style={styles.ovTitle}>Sin movimientos</Text>
          <Text style={styles.ovText}>Has usado los {level.maxMoves} movimientos de este nivel.</Text>
          <Button variant="primary" label="Reintentar" style={styles.full} onPress={game.restart} />
          <Button label="Deshacer último" style={styles.full} onPress={game.undo} />
        </Overlay>
      ) : null}

      {win ? (
        <Overlay accent="rgba(92,255,176,0.4)">
          <VictoryBurst />
          <Text style={styles.ovTitle}>Nivel completado</Text>
          <View style={styles.result}>
            <Text style={styles.resultValue}>{win.moves}</Text>
            <Text style={styles.resultLabel}>movimientos</Text>
          </View>
          <Text style={styles.ovText}>
            {win.prevBest === undefined
              ? 'Primer intento superado.'
              : win.moves < win.prevBest
                ? `¡Nuevo récord! Antes: ${win.prevBest}`
                : `Tu mejor resultado: ${win.prevBest}`}
          </Text>
          {next ? (
            <Button
              variant="primary"
              label="Siguiente nivel"
              style={styles.full}
              onPress={() => router.replace({ pathname: '/play/[id]', params: { id: next } })}
            />
          ) : (
            <Text style={[styles.ovText, { color: colors.exit }]}>Has completado todos los niveles de ECHO.</Text>
          )}
          <Button label="Repetir" style={styles.full} onPress={replay} />
          <Button label="Ver niveles" variant="ghost" style={styles.full} onPress={() => router.replace('/levels')} />
        </Overlay>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelName: { textAlign: 'center', color: colors.textDim, fontSize: 14, marginTop: -6 },
  hud: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 20, marginTop: 16, gap: 22 },
  stat: { gap: 4 },
  statLabel: { color: colors.textFaint, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase' },
  statValue: { color: colors.text, fontSize: 24, fontWeight: '700', fontVariant: ['tabular-nums'] },
  statMax: { color: colors.textFaint, fontSize: 16, fontWeight: '500' },
  hint: {
    marginHorizontal: 20,
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: 'rgba(45,226,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(45,226,255,0.18)',
  },
  hintText: { color: colors.text, fontSize: 14, lineHeight: 20 },
  boardArea: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  swipeHint: { color: colors.textFaint, fontSize: 13, letterSpacing: 1 },
  ovTitle: { color: colors.text, fontSize: 22, fontWeight: '700', letterSpacing: 0.5 },
  ovText: { color: colors.textDim, fontSize: 14, textAlign: 'center' },
  full: { alignSelf: 'stretch' },
  result: { alignItems: 'center' },
  resultValue: { color: colors.text, fontSize: 48, fontWeight: '800', fontVariant: ['tabular-nums'] },
  resultLabel: { color: colors.textDim, fontSize: 13, letterSpacing: 1.5, textTransform: 'uppercase' },
});
