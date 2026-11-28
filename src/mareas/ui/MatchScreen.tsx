/** A MAREAS match: the 3D sea, the tide clock, both lighthouses, your energy and your hand. */
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CARDS,
  MAX_ENERGY,
  RUSH_TIME,
  STARTER_DECK,
  TIDE_PERIOD,
  aiDeckFor,
  createBrain,
  createMatch,
  islandsOf,
  playCard,
  playableDeck,
  seaById,
  type CardId,
  type MatchEvent,
  type MatchState,
  type Result,
  type Reward,
  type SeaId,
  type Tide,
} from '../engine';
import { useMareas } from '../state/MareasState';
import { Scene3D } from '../three/Scene3D';
import Animated from 'react-native-reanimated';
import { Btn } from './Btn';
import { Card } from './Card';
import { RulesPanel } from './Rules';
import { bannerIn, bannerOut, haptic, overlayIn, panelIn } from './motion';
import { mt } from './theme';
import { TUTORIAL, type TutorialStep } from './tutorial';

interface Hud {
  energy: number;
  tide: Tide;
  tideLeft: number;
  time: number;
  duration: number;
  hp: { player: number; ai: number };
  max: { player: number; ai: number };
  hand: CardId[];
  next: CardId;
  result: Result | null;
  isles: { player: number; ai: number };
}

const snapshot = (s: MatchState): Hud => ({
  energy: s.players.player.energy,
  tide: s.tide,
  tideLeft: s.tideLeft,
  time: s.time,
  duration: s.duration,
  hp: { player: s.players.player.lighthouse, ai: s.players.ai.lighthouse },
  max: { player: s.players.player.lighthouseMax, ai: s.players.ai.lighthouseMax },
  hand: [...s.players.player.hand],
  next: s.players.player.queue[0],
  result: s.result,
  isles: { player: islandsOf(s, 'player'), ai: islandsOf(s, 'ai') },
});

export function MatchScreen({ sea, tutorial }: { sea: SeaId; tutorial: boolean }) {
  const insets = useSafeAreaInsets();
  const { save, finishMatch } = useMareas();
  const seaDef = seaById(sea);
  // A stable box for the mutable match (the 3D scene reads it every frame).
  const [initial] = useState(() =>
    createMatch({
      sea,
      tutorial,
      playerDeck: tutorial ? STARTER_DECK : playableDeck(save),
      aiDeck: aiDeckFor(sea),
      playerLevels: save.levels,
      aiLevels: Object.fromEntries(aiDeckFor(sea).map((c) => [c, seaDef.aiLevel])),
      seed: Math.floor(Math.random() * 1e9),
      aiEnergyRate: tutorial ? 0.6 : seaDef.aiEnergy,
    }),
  );
  const state = useRef(initial);
  const brains = useMemo(() => ({ ai: createBrain(tutorial ? 1 : seaDef.aiLevel) }), [tutorial, seaDef.aiLevel]);
  const [hud, setHud] = useState<Hud>(() => snapshot(initial));
  const [selected, setSelected] = useState<number | null>(null);
  const [banner, setBanner] = useState<{ text: string; color: string; key: number } | null>(null);
  const [menu, setMenu] = useState<'pause' | 'rules' | null>(null);
  const [reward, setReward] = useState<Reward | null>(null);
  const [step, setStep] = useState(tutorial ? 0 : -1);
  const stepStart = useRef(0);
  const rushShown = useRef(false);

  // HUD refresh, ten times per second. Also saves the reward once when the match ends.
  const rewarded = useRef(false);
  useEffect(() => {
    const id = setInterval(() => {
      const snap = snapshot(state.current);
      setHud(snap);
      if (snap.result && !rewarded.current) {
        rewarded.current = true;
        if (snap.result === 'win') haptic.win();
        else if (snap.result === 'lose') haptic.fail();
        setReward(finishMatch(snap.result, tutorial));
      }
    }, 100);
    return () => clearInterval(id);
  }, [finishMatch, tutorial]);

  const showBanner = useCallback((text: string, color: string) => setBanner({ text, color, key: Date.now() }), []);
  useEffect(() => {
    if (!banner) return;
    const id = setTimeout(() => setBanner(null), 2200);
    return () => clearTimeout(id);
  }, [banner]);

  const tutStep: TutorialStep | null = step >= 0 && step < TUTORIAL.length ? TUTORIAL[step] : null;
  // If the card a step waits for was already played, the step gets a button instead.
  const waitCard = tutStep?.waitCard && hud.hand.includes(tutStep.waitCard) ? tutStep.waitCard : undefined;
  const tutButton = tutStep ? (tutStep.button ?? (tutStep.waitCard && !waitCard ? 'Siguiente' : undefined)) : undefined;
  const advance = useCallback(() => {
    setStep((s) => {
      const n = s + 1;
      stepStart.current = state.current.time;
      if (n >= TUTORIAL.length) {
        state.current.aiActive = true;
        state.current.paused = false;
        return -1;
      }
      return n;
    });
  }, []);

  // Pause logic for the guided match and the menu.
  useEffect(() => {
    state.current.paused = !!menu || (!!tutStep && tutStep.pause);
  }, [menu, tutStep]);

  // Tutorial steps that finish on their own.
  useEffect(() => {
    if (!tutStep?.until) return;
    if (tutStep.until(state.current, state.current.time - stepStart.current)) advance();
  }, [hud, tutStep, advance]);

  const onEvents = useCallback(
    (events: MatchEvent[]) => {
      for (const e of events) {
        if (e.type === 'capture') {
          const name = state.current.map.islands[e.island].name;
          showBanner(
            e.side === 'player' ? `🏝️ ¡Has conquistado ${name}!` : `🏝️ El rival ha conquistado ${name}`,
            e.side === 'player' ? mt.player : mt.ai,
          );
        }
        if (e.type === 'tide') {
          haptic.tide();
          showBanner(
            e.tide === 'high' ? '🌊 ¡Sube la marea! Salen los barcos' : '🏖️ ¡Baja la marea! Cruzan las criaturas',
            e.tide === 'high' ? mt.high : mt.low,
          );
        }
      }
      const s = state.current;
      if (!rushShown.current && s.duration - s.time <= RUSH_TIME && !s.tutorial) {
        rushShown.current = true;
        showBanner('⚡ ¡Último minuto! Energía doble', mt.energy);
      }
    },
    [showBanner],
  );

  const selectedCard = selected !== null ? hud.hand[selected] : null;
  const selDef = selectedCard ? CARDS[selectedCard] : null;

  const tryPlay = (island: number | null) => {
    if (selected === null) return;
    const card = state.current.players.player.hand[selected];
    const err = playCard(state.current, 'player', selected, island);
    if (err === 'energy') {
      haptic.fail();
      showBanner('Te falta energía ⚡', mt.bad);
    }
    setSelected(null);
    if (!err) {
      haptic.play();
      setHud(snapshot(state.current));
      if (waitCard === card) advance();
    }
  };

  const tapCard = (i: number) => {
    if (hud.result) return;
    const card = hud.hand[i];
    if (waitCard && waitCard !== card) {
      showBanner(`Toca la carta ${CARDS[waitCard].name}`, mt.low);
      return;
    }
    if (selected === i) {
      // Second tap plays cards that do not need a lane.
      if (!CARDS[card].needsTarget) return tryPlay(null);
      return setSelected(null);
    }
    if (hud.energy + 1e-6 < CARDS[card].cost) {
      showBanner(`${CARDS[card].name} cuesta ${CARDS[card].cost} ⚡. Espera un poco`, mt.energy);
      return;
    }
    haptic.select();
    setSelected(i);
  };

  // Stable callback so the memoised 3D scene does not re-render with every HUD tick.
  const tryPlayRef = useRef(tryPlay);
  useEffect(() => {
    tryPlayRef.current = tryPlay;
  });
  const onIslandTap = useCallback((island: number) => tryPlayRef.current(island), []);

  const selecting = selDef?.needsTarget
    ? selDef.kind === 'spell'
      ? 'spell'
      : selDef.kind === 'build'
        ? 'build'
        : 'unit'
    : null;

  const noteFor = (id: CardId) => {
    const k = CARDS[id].kind;
    if (k === 'creature' && hud.tide === 'high' && id !== 'tortuga') return 'Espera la baja';
    if (k === 'boat' && hud.tide === 'low') return 'Espera la alta';
    return null;
  };

  const hint = selDef
    ? selDef.needsTarget
      ? selDef.unit
        ? `Toca la isla a la que mandas ${selDef.name}`
        : `Toca una isla para usar ${selDef.name}`
      : `Toca otra vez ${selDef.name} para usarla`
    : null;

  const timeLeft = Math.max(0, hud.duration - hud.time);
  const mm = Math.floor(timeLeft / 60);
  const ss = Math.floor(timeLeft % 60)
    .toString()
    .padStart(2, '0');

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Rival bar */}
      <View style={styles.top}>
        <Pressable onPress={() => setMenu('pause')} style={styles.pauseBtn} accessibilityLabel="Pausa">
          <Text style={styles.pauseText}>II</Text>
        </Pressable>
        <LighthouseBar label="Faro rival" isles={hud.isles.ai} hp={hud.hp.ai} max={hud.max.ai} color={mt.ai} />
        <View style={styles.timer}>
          <Text style={[styles.timerText, timeLeft <= RUSH_TIME && { color: mt.energy }]}>
            {mm}:{ss}
          </Text>
        </View>
      </View>

      <View style={styles.scene}>
        <Scene3D
          state={state}
          sea={sea}
          brains={brains}
          selecting={selecting}
          onIslandTap={onIslandTap}
          onEvents={onEvents}
        />
        <TideClock tide={hud.tide} left={hud.tideLeft} highlight={tutStep?.focus === 'clock'} />
        {banner ? (
          <Animated.View
            key={banner.key}
            entering={bannerIn}
            exiting={bannerOut}
            style={[styles.banner, { borderColor: banner.color }]}
            pointerEvents="none"
          >
            <Text style={styles.bannerText}>{banner.text}</Text>
          </Animated.View>
        ) : null}
        {hint ? (
          <Animated.View entering={bannerIn} exiting={bannerOut} style={styles.hint} pointerEvents="none">
            <Text style={styles.hintText}>{hint}</Text>
          </Animated.View>
        ) : null}
        {tutStep && selected === null ? (
          <Animated.View key={step} entering={panelIn} style={styles.tutorial} pointerEvents="box-none">
            <View style={styles.tutorialBox}>
              <Text style={styles.tutorialText}>{tutStep.text}</Text>
              {tutButton ? <Btn small label={tutButton} onPress={advance} /> : null}
            </View>
          </Animated.View>
        ) : null}
      </View>

      {/* Player area */}
      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <View style={styles.row}>
          <LighthouseBar
            label="Tu faro"
            isles={hud.isles.player}
            hp={hud.hp.player}
            max={hud.max.player}
            color={mt.player}
          />
        </View>
        <View style={styles.hand}>
          {hud.hand.map((id, i) => (
            <Card
              key={`${i}-${id}`}
              id={id}
              selected={selected === i}
              energy={hud.energy}
              note={noteFor(id)}
              onPress={() => tapCard(i)}
              dim={!!waitCard && waitCard !== id}
            />
          ))}
          <View style={styles.next}>
            <Text style={styles.nextLabel}>Luego</Text>
            <Text style={styles.nextIcon}>{CARDS[hud.next].icon}</Text>
          </View>
        </View>
        <EnergyBar energy={hud.energy} />
      </View>

      {menu ? (
        <Animated.View entering={overlayIn} style={styles.overlay}>
          {menu === 'rules' ? (
            <RulesPanel onClose={() => setMenu('pause')} />
          ) : (
            <Animated.View entering={panelIn} style={styles.panel}>
              <Text style={styles.panelTitle}>Pausa</Text>
              <Btn label="Seguir" onPress={() => setMenu(null)} />
              <Btn label="Cómo se juega" variant="sea" onPress={() => setMenu('rules')} />
              <Btn label="Salir de la partida" variant="ghost" onPress={() => router.back()} />
            </Animated.View>
          )}
        </Animated.View>
      ) : null}

      {hud.result && reward ? (
        <Animated.View entering={overlayIn} style={styles.overlay}>
          <Animated.View entering={panelIn} style={styles.panel}>
            <Text style={styles.resultIcon}>{hud.result === 'win' ? '🏆' : hud.result === 'draw' ? '🤝' : '🌧️'}</Text>
            <Text style={styles.panelTitle}>
              {hud.result === 'win' ? '¡Victoria!' : hud.result === 'draw' ? 'Empate' : 'Derrota'}
            </Text>
            <Text style={styles.resultSub}>
              {hud.result === 'win'
                ? hud.hp.ai <= 0
                  ? 'Apagaste el faro rival.'
                  : 'Tu faro brillaba más al acabar el tiempo.'
                : hud.result === 'lose'
                  ? hud.hp.player <= 0
                    ? 'Apagaron tu faro. ¡A la próxima!'
                    : 'El faro rival tenía más luz al final.'
                  : 'Los dos faros acabaron igual.'}
            </Text>
            <View style={styles.rewards}>
              <Text style={styles.reward}>
                🐚 {reward.shells >= 0 ? '+' : ''}
                {reward.shells} conchas
              </Text>
              <Text style={styles.reward}>⚪ +{reward.pearls} perlas</Text>
            </View>
            {reward.newSea ? (
              <View style={styles.newSea}>
                <Text style={styles.newSeaTitle}>¡Nuevo mar: {seaById(reward.newSea).name}!</Text>
                <Text style={styles.newSeaText}>
                  Cartas nuevas: {reward.newCards.map((c) => `${CARDS[c].icon} ${CARDS[c].name}`).join(', ')}
                </Text>
              </View>
            ) : null}
            <Btn
              label="Otra partida"
              onPress={() => router.replace({ pathname: '/mareas/match', params: { sea: reward.newSea ?? sea } })}
            />
            <Btn label="Menú" variant="ghost" onPress={() => router.back()} />
          </Animated.View>
        </Animated.View>
      ) : null}
    </View>
  );
}

function LighthouseBar({
  label,
  hp,
  max,
  color,
  isles,
}: {
  label: string;
  hp: number;
  max: number;
  color: string;
  isles: number;
}) {
  const k = Math.max(0, hp / max);
  return (
    <View style={styles.lh}>
      <Text style={styles.lhLabel}>
        🗼 {label} <Text style={{ color: mt.dim }}>{Math.ceil(hp)}</Text>
        {isles > 0 ? <Text style={{ color: mt.dim }}>{`  ·  🏝️ ${isles}`}</Text> : null}
      </Text>
      <View style={styles.lhTrack}>
        <View style={[styles.lhFill, { width: `${k * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function TideClock({ tide, left, highlight }: { tide: Tide; left: number; highlight?: boolean }) {
  const soon = left <= 4;
  const low = tide === 'low';
  return (
    <View style={[styles.clock, highlight && styles.clockFocus]} pointerEvents="none">
      <Text style={styles.clockIcon}>{low ? '🏖️' : '🌊'}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.clockTitle} numberOfLines={1}>
          Marea {low ? 'baja' : 'alta'}
        </Text>
        <Text style={[styles.clockSub, soon && { color: '#FFFFFF' }]}>
          {low ? 'Sube' : 'Baja'} en {Math.ceil(left)} s
        </Text>
        <View style={styles.clockTrack}>
          <View
            style={[
              styles.clockFill,
              { width: `${(left / TIDE_PERIOD) * 100}%`, backgroundColor: low ? mt.low : mt.high },
              soon && { backgroundColor: '#FFFFFF' },
            ]}
          />
        </View>
      </View>
      <Text style={styles.clockNext}>{low ? '🌊' : '🏖️'}</Text>
    </View>
  );
}

function EnergyBar({ energy }: { energy: number }) {
  return (
    <View style={styles.energy}>
      <Text style={styles.energyNum}>⚡ {Math.floor(energy)}</Text>
      <View style={styles.energyTrack}>
        {Array.from({ length: MAX_ENERGY }, (_, i) => (
          <View key={i} style={styles.energyCell}>
            <View style={[styles.energyFill, { width: `${Math.max(0, Math.min(1, energy - i)) * 100}%` }]} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: mt.bg },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8 },
  pauseBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: mt.panel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseText: { color: mt.text, fontWeight: '900', fontSize: 15 },
  timer: { backgroundColor: mt.panel, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  timerText: { color: mt.text, fontWeight: '900', fontSize: 16, fontVariant: ['tabular-nums'] },
  lh: { flex: 1, gap: 3 },
  lhLabel: { color: mt.text, fontWeight: '800', fontSize: 12 },
  lhTrack: { height: 10, borderRadius: 5, backgroundColor: 'rgba(0,0,0,0.35)', overflow: 'hidden' },
  lhFill: { height: '100%', borderRadius: 5 },
  scene: { flex: 1 },
  clock: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 178,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(8,30,48,0.82)',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  clockFocus: { borderColor: '#FFFFFF' },
  clockIcon: { fontSize: 22 },
  clockTitle: { color: mt.text, fontWeight: '900', fontSize: 13 },
  clockSub: { color: mt.dim, fontWeight: '700', fontSize: 11 },
  clockTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginTop: 3,
    overflow: 'hidden',
  },
  clockFill: { height: '100%' },
  clockNext: { fontSize: 18, opacity: 0.8 },
  banner: {
    position: 'absolute',
    top: 92,
    alignSelf: 'center',
    backgroundColor: 'rgba(8,30,48,0.9)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 2,
    maxWidth: '92%',
  },
  bannerText: { color: mt.text, fontWeight: '900', fontSize: 15, textAlign: 'center' },
  hint: {
    position: 'absolute',
    bottom: 8,
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  hintText: { color: '#10283C', fontWeight: '900', fontSize: 14 },
  tutorial: { position: 'absolute', left: 12, right: 12, bottom: 10, alignItems: 'center' },
  tutorialBox: {
    backgroundColor: '#FFFDF5',
    borderRadius: 16,
    padding: 14,
    gap: 10,
    width: '100%',
    maxWidth: 440,
    borderWidth: 3,
    borderColor: mt.player,
  },
  tutorialText: { color: '#1C2A38', fontSize: 15, lineHeight: 21, fontWeight: '600' },
  bottom: {
    backgroundColor: mt.panel,
    paddingHorizontal: 10,
    paddingTop: 8,
    gap: 8,
    borderTopWidth: 2,
    borderColor: mt.border,
  },
  row: { flexDirection: 'row' },
  hand: { flexDirection: 'row', gap: 6, alignItems: 'flex-end' },
  next: { width: 40, alignItems: 'center', justifyContent: 'center', paddingBottom: 10 },
  nextLabel: { color: mt.faint, fontSize: 10, fontWeight: '800' },
  nextIcon: { fontSize: 22, opacity: 0.8 },
  energy: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  energyNum: { color: mt.energy, fontWeight: '900', fontSize: 16, width: 44 },
  energyTrack: { flex: 1, flexDirection: 'row', gap: 3 },
  energyCell: { flex: 1, height: 14, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.35)', overflow: 'hidden' },
  energyFill: { height: '100%', backgroundColor: mt.energy },
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
  panel: {
    backgroundColor: mt.panel,
    borderRadius: 20,
    padding: 20,
    gap: 12,
    width: '100%',
    maxWidth: 400,
    borderWidth: 2,
    borderColor: mt.border,
  },
  panelTitle: { color: mt.text, fontSize: 28, fontWeight: '900', textAlign: 'center' },
  resultIcon: { fontSize: 54, textAlign: 'center' },
  resultSub: { color: mt.dim, textAlign: 'center', fontSize: 15 },
  rewards: { flexDirection: 'row', justifyContent: 'center', gap: 16 },
  reward: { color: mt.text, fontWeight: '900', fontSize: 16 },
  newSea: { backgroundColor: mt.panelHigh, borderRadius: 14, padding: 12, gap: 4 },
  newSeaTitle: { color: mt.low, fontWeight: '900', fontSize: 16, textAlign: 'center' },
  newSeaText: { color: mt.text, textAlign: 'center' },
});
