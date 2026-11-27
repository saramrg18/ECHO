import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BUILDING_NAMES,
  CAMPAIGN,
  CARDS,
  activeSynergies,
  aiDeckFor,
  applyAction,
  canMove,
  cardTargets,
  cellsOf,
  createMatch,
  defenseBonus,
  incomeOf,
  neighbors,
  planAiTurn,
  type Action,
  type CardId,
  type GameEvent,
  type MapDef,
  type MatchState,
} from '../engine';
import { useHex } from '../state/HexState';
import { Board3D, type Fx, type Highlight } from '../three/Board3D';
import { CardView } from './CardView';
import { HxButton } from './HxButton';
import { hx } from './theme';

const AI_STEP_MS = 650;

export function MatchScreen({ map }: { map: MapDef }) {
  const insets = useSafeAreaInsets();
  const { save, winMap, seenTutorial, markTutorial } = useHex();
  const newMatch = useCallback(
    () =>
      createMatch({
        map,
        playerDeck: save.deck,
        aiDeck: aiDeckFor(map),
        seed: Math.floor(Math.random() * 1e9),
      }),
    [map, save.deck],
  );
  const [match, setMatch] = useState<MatchState>(newMatch);
  const [selectedCell, setSelectedCell] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<number | null>(null);
  const [fx, setFx] = useState<Fx[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState<CardId[] | null>(null);
  const [tutorial, setTutorial] = useState(!seenTutorial && map.id === CAMPAIGN[0].id);
  const fxId = useRef(0);
  const matchRef = useRef(match);

  const pushFx = useCallback((events: GameEvent[]) => {
    if (events.length === 0) return;
    setFx((list) => [...list.slice(-24), ...events.map((event) => ({ id: ++fxId.current, event }))]);
  }, []);

  const act = useCallback(
    (action: Action) => {
      const res = applyAction(matchRef.current, action);
      if (res.error) {
        setNote(res.error);
        return false;
      }
      matchRef.current = res.state;
      setMatch(res.state);
      pushFx(res.events);
      setNote(null);
      if (res.state.winner === 'player') setUnlocked(winMap(map));
      return true;
    },
    [pushFx, winMap, map],
  );

  // Rival turn: plan, then replay step by step so the player can follow it.
  useEffect(() => {
    if (match.turn !== 'ai' || match.winner) return;
    const plan = planAiTurn(match);
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    const step = () => {
      if (i >= plan.length) return;
      act(plan[i++]);
      timer = setTimeout(step, AI_STEP_MS);
    };
    timer = setTimeout(step, AI_STEP_MS);
    return () => clearTimeout(timer);
    // Only re-plan when the turn changes hands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.turn, match.round, match.winner]);

  const myTurn = match.turn === 'player' && !match.winner;
  const me = match.sides.player;

  const highlights = useMemo(() => {
    const h: Record<string, Highlight> = {};
    if (!myTurn) return h;
    if (selectedCard !== null) {
      for (const id of cardTargets(match, selectedCard)) h[id] = 'card';
      return h;
    }
    if (selectedCell && match.cells[selectedCell].owner === 'player') {
      for (const n of neighbors(match, selectedCell)) {
        if (canMove(match, selectedCell, n.id) === null) h[n.id] = n.owner === 'player' ? 'move' : 'attack';
      }
    }
    return h;
  }, [match, myTurn, selectedCard, selectedCell]);

  const onTap = useCallback(
    (id: string | null) => {
      if (!myTurn) return;
      if (selectedCard !== null) {
        if (id && highlights[id] === 'card') act({ type: 'card', index: selectedCard, target: id });
        setSelectedCard(null);
        return;
      }
      if (!id) return setSelectedCell(null);
      if (selectedCell && id !== selectedCell && highlights[id]) {
        act({ type: 'move', from: selectedCell, to: id });
        setSelectedCell(null);
        return;
      }
      setSelectedCell(id === selectedCell ? null : id);
    },
    [act, highlights, myTurn, selectedCard, selectedCell],
  );

  const tapCard = (index: number) => {
    if (!myTurn) return;
    const card = me.hand[index];
    if (CARDS[card].cost > me.energy) return setNote(`Necesitas ${CARDS[card].cost} de energía.`);
    setSelectedCell(null);
    setSelectedCard(selectedCard === index ? null : index);
    setNote(null);
  };

  const endTurn = () => {
    setSelectedCell(null);
    setSelectedCard(null);
    act({ type: 'end' });
  };

  const restart = () => {
    const m = newMatch();
    matchRef.current = m;
    setMatch(m);
    setSelectedCell(null);
    setSelectedCard(null);
    setUnlocked(null);
    setFx([]);
  };
  const nextMap = CAMPAIGN[CAMPAIGN.findIndex((m) => m.id === map.id) + 1];

  const playerCells = cellsOf(match, 'player').length;
  const aiCells = cellsOf(match, 'ai').length;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Top HUD */}
      <View style={styles.hud}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Salir"
          onPress={() => router.back()}
          style={styles.close}
          hitSlop={8}
        >
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
        <View style={styles.score}>
          <Chip color={hx.player} label={`Tú ${playerCells}`} />
          <Text style={styles.round}>
            Ronda {Math.min(match.round, match.maxRounds)}/{match.maxRounds}
          </Text>
          <Chip color={hx.ai} label={`${aiCells} Rival`} />
        </View>
        <View style={styles.close} />
      </View>

      {/* 3D board */}
      <View style={styles.board}>
        <Board3D state={match} selected={selectedCell} highlights={highlights} fx={fx} onTap={onTap} />
        {match.turn === 'ai' && !match.winner && (
          <View style={styles.banner} pointerEvents="none">
            <Text style={styles.bannerText}>Turno del rival…</Text>
          </View>
        )}
      </View>

      {/* Info + actions */}
      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <InfoPanel
          match={match}
          selectedCell={selectedCell}
          selectedCard={selectedCard}
          note={note}
          myTurn={myTurn}
          onPlace={(amount) => selectedCell && act({ type: 'place', cell: selectedCell, amount })}
          onUseCard={() => {
            if (selectedCard !== null) act({ type: 'card', index: selectedCard });
            setSelectedCard(null);
          }}
        />
        <View style={styles.row}>
          <View style={styles.stats}>
            <Text style={styles.stat}>
              <Text style={{ color: hx.energy }}>⚡ {me.energy}</Text>
              <Text style={styles.statDim}> energía</Text>
            </Text>
            <Text style={styles.stat}>
              <Text style={{ color: hx.gold }}>👥 {me.pool}</Text>
              <Text style={styles.statDim}> por colocar</Text>
            </Text>
          </View>
          <HxButton label="Fin del turno" onPress={endTurn} disabled={!myTurn} variant="gold" small />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hand}>
          {me.hand.map((c, i) => (
            <CardView
              key={`${c}-${i}`}
              id={c}
              selected={selectedCard === i}
              disabled={!myTurn || CARDS[c].cost > me.energy}
              onPress={() => tapCard(i)}
            />
          ))}
          {me.hand.length === 0 && <Text style={styles.statDim}>Sin cartas. Robas una al empezar cada turno.</Text>}
        </ScrollView>
      </View>

      <Modal visible={tutorial} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Cómo se juega</Text>
            <Tip
              icon="👆"
              text="Toca una casilla tuya (azul) y luego una vecina para mover tus tropas. Siempre se queda 1."
            />
            <Tip icon="⚔️" text="Si atacas con más tropas que la defensa de la casilla, la conquistas." />
            <Tip icon="👥" text="Cada turno recibes tropas: toca una casilla tuya y pulsa +1 o +Todas." />
            <Tip icon="🃏" text="Las cartas cuestan energía ⚡. Las torres vecinas se combinan y ganan bonus." />
            <Tip icon="🏰" text="Gana quien conquiste el castillo rival. Arrastra para girar la cámara." />
            <HxButton
              label="¡A jugar!"
              variant="gold"
              onPress={() => {
                setTutorial(false);
                markTutorial();
              }}
            />
          </View>
        </View>
      </Modal>

      <Modal visible={!!match.winner} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <Text style={[styles.modalTitle, { fontSize: 30 }]}>
              {match.winner === 'player' ? '¡Victoria!' : match.winner === 'ai' ? 'Derrota' : 'Empate'}
            </Text>
            <Text style={styles.modalText}>
              {match.winner === 'player'
                ? `Has conquistado ${map.name}.`
                : match.winner === 'ai'
                  ? 'El rival ha ganado esta vez. ¡Prueba otra estrategia!'
                  : 'Se acabaron las rondas con el mismo territorio.'}
            </Text>
            {unlocked && unlocked.length > 0 && (
              <>
                <Text style={styles.unlockTitle}>Nueva carta desbloqueada</Text>
                <View style={styles.unlockRow}>
                  <CardView id={unlocked[0]} badge={`x${unlocked.length}`} />
                </View>
              </>
            )}
            {match.winner === 'player' && nextMap ? (
              <HxButton
                label={`Siguiente: ${nextMap.name}`}
                variant="gold"
                onPress={() =>
                  router.replace({
                    pathname: '/hexfort/match/[map]',
                    params: { map: nextMap.id },
                  })
                }
              />
            ) : (
              <HxButton label="Jugar otra vez" variant="gold" onPress={restart} />
            )}
            <HxButton label="Volver al menú" onPress={() => router.back()} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Chip({ color, label }: { color: string; label: string }) {
  return (
    <View style={[styles.chip, { backgroundColor: color }]}>
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

function Tip({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.tip}>
      <Text style={styles.tipIcon}>{icon}</Text>
      <Text style={styles.tipText}>{text}</Text>
    </View>
  );
}

function InfoPanel({
  match,
  selectedCell,
  selectedCard,
  note,
  myTurn,
  onPlace,
  onUseCard,
}: {
  match: MatchState;
  selectedCell: string | null;
  selectedCard: number | null;
  note: string | null;
  myTurn: boolean;
  onPlace(amount: number): void;
  onUseCard(): void;
}) {
  const me = match.sides.player;
  let title = '';
  let body = '';
  let actions: React.ReactNode = null;

  if (selectedCard !== null) {
    const def = CARDS[me.hand[selectedCard]];
    title = def.name;
    body = def.target === 'none' ? def.text : `${def.text} Toca una casilla marcada.`;
    if (def.target === 'none') actions = <HxButton label="Usar" variant="gold" small onPress={onUseCard} />;
  } else if (selectedCell) {
    const c = match.cells[selectedCell];
    const owner = c.owner === 'player' ? 'Tuya' : c.owner === 'ai' ? 'Rival' : 'Neutral';
    const terrain = {
      plain: 'Llanura',
      forest: 'Bosque',
      hill: 'Colina',
      water: 'Agua',
    }[c.terrain];
    title = `${owner} · ${terrain}${c.building ? ` · ${BUILDING_NAMES[c.building]}` : ''}`;
    const syn = activeSynergies(match, c.id)
      .map((s) => `✨ ${s.name}`)
      .join('  ');
    body = `${c.troops} tropas · defensa ${c.troops + defenseBonus(match, c.id)}${c.shielded ? ' · con escudo' : ''}${syn ? `\n${syn}` : ''}`;
    if (c.owner === 'player' && myTurn && me.pool > 0) {
      actions = (
        <View style={styles.row}>
          <HxButton label="+1" small onPress={() => onPlace(1)} />
          <HxButton label={`+${me.pool}`} small variant="gold" onPress={() => onPlace(me.pool)} />
        </View>
      );
    }
  } else if (myTurn) {
    const inc = incomeOf(match, 'player');
    title = 'Tu turno';
    body =
      me.pool > 0
        ? `Tienes ${me.pool} tropas por colocar. Toca una casilla azul.`
        : `Mueve tropas, juega cartas o termina el turno. Próximo turno: +${inc.troops} tropas, +${inc.energy} ⚡`;
  } else if (!match.winner) {
    title = 'Rival';
    body = 'El rival está moviendo…';
  }

  return (
    <View style={styles.info}>
      <View style={{ flex: 1 }}>
        {note ? <Text style={styles.note}>{note}</Text> : <Text style={styles.infoTitle}>{title}</Text>}
        <Text style={styles.infoBody} numberOfLines={3}>
          {body}
        </Text>
      </View>
      {actions}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: hx.bg },
  hud: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    height: 50,
  },
  close: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: hx.dim, fontSize: 20, fontWeight: '700' },
  score: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  round: { color: hx.text, fontWeight: '800', fontSize: 14 },
  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  board: { flex: 1, overflow: 'hidden' },
  banner: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    backgroundColor: 'rgba(163,32,43,0.9)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
  },
  bannerText: { color: '#fff', fontWeight: '800' },
  bottom: {
    backgroundColor: hx.bg,
    paddingHorizontal: 10,
    paddingTop: 8,
    gap: 8,
    borderTopWidth: 1,
    borderColor: hx.border,
  },
  info: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: hx.panel,
    borderRadius: 12,
    padding: 10,
    minHeight: 64,
  },
  infoTitle: { color: hx.text, fontWeight: '800', fontSize: 14 },
  infoBody: { color: hx.dim, fontSize: 12.5, marginTop: 2 },
  note: { color: hx.gold, fontWeight: '800', fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stats: { flex: 1, flexDirection: 'row', gap: 14 },
  stat: { color: hx.text, fontWeight: '800', fontSize: 15 },
  statDim: { color: hx.faint, fontWeight: '600', fontSize: 12 },
  hand: { gap: 10, paddingTop: 12, paddingHorizontal: 8, paddingBottom: 2 },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(5,10,20,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modal: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: hx.panel,
    borderRadius: 20,
    padding: 20,
    gap: 12,
    borderWidth: 2,
    borderColor: hx.gold,
  },
  modalTitle: {
    color: hx.gold,
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
  },
  modalText: { color: hx.text, fontSize: 15, textAlign: 'center' },
  unlockTitle: {
    color: hx.dim,
    textAlign: 'center',
    fontWeight: '700',
    marginTop: 4,
  },
  unlockRow: { alignItems: 'center', paddingVertical: 6 },
  tip: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  tipIcon: { fontSize: 20, width: 28 },
  tipText: { color: hx.text, flex: 1, fontSize: 14, lineHeight: 19 },
});
