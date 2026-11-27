import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { delta, isDoorOpen, samePos, type Direction, type GameState, type MovePreview, type StepEvent, type Tile, type Vec } from '../../engine';
import { colors, motion } from '../theme';
import { Arrow } from './Icon';

interface Props {
  state: GameState;
  /** Size available for the board, in px. */
  maxWidth: number;
  maxHeight: number;
  /** Direction of the echo that will repeat after the next move (preview). */
  nextEcho?: Direction;
  /** Changes on every accepted turn / undo / restart, to trigger animations. */
  version: number;
  /** Ghost preview of the move being considered. */
  preview?: MovePreview | null;
  /** Direction suggested by a hint. */
  hintDir?: Direction;
}

const MAX_CELL = 64;

export function Board({ state, maxWidth, maxHeight, nextEcho, version, preview, hintDir }: Props) {
  const { board } = state.level;
  const cell = Math.floor(Math.min(maxWidth / board.width, maxHeight / board.height, MAX_CELL));
  const width = cell * board.width;
  const height = cell * board.height;

  return (
    <View style={{ width, height }}>
      <StaticTiles state={state} cell={cell} />
      {preview ? <GhostPreview preview={preview} cell={cell} /> : null}
      <Piece state={state} cell={cell} nextEcho={preview ? undefined : nextEcho} version={version} hintDir={preview ? undefined : hintDir} />
    </View>
  );
}

/* ---------------- tiles ---------------- */

const StaticTiles = memo(function StaticTiles({ state, cell }: { state: GameState; cell: number }) {
  const { board } = state.level;
  const toggled = state.toggledGroups;
  const collapsed = useMemo(() => new Set(state.collapsed), [state.collapsed]);
  return (
    <>
      {board.tiles.map((tile, i) => {
        if (tile.kind === 'void') return null;
        const x = i % board.width;
        const y = Math.floor(i / board.width);
        return (
          <View key={i} style={{ position: 'absolute', left: x * cell, top: y * cell, width: cell, height: cell }}>
            <TileView tile={tile} cell={cell} alt={(x + y) % 2 === 1} toggled={toggled} collapsed={collapsed.has(i)} />
          </View>
        );
      })}
    </>
  );
});

function Floor({ cell, alt, children }: { cell: number; alt: boolean; children?: React.ReactNode }) {
  const inset = Math.max(1, cell * 0.04);
  return (
    <View
      style={{
        position: 'absolute',
        left: inset,
        top: inset,
        right: inset,
        bottom: inset,
        borderRadius: cell * 0.14,
        backgroundColor: alt ? colors.tileAlt : colors.tile,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </View>
  );
}

function TileView({
  tile,
  cell,
  alt,
  toggled,
  collapsed,
}: {
  tile: Tile;
  cell: number;
  alt: boolean;
  toggled: readonly string[];
  collapsed: boolean;
}) {
  switch (tile.kind) {
    case 'wall':
      return (
        <View
          style={{
            position: 'absolute',
            left: cell * 0.02,
            top: cell * 0.02,
            right: cell * 0.02,
            bottom: cell * 0.02,
            borderRadius: cell * 0.12,
            backgroundColor: colors.wall,
            borderTopWidth: Math.max(1, cell * 0.05),
            borderTopColor: colors.wallTop,
          }}
        />
      );
    case 'exit':
      return (
        <Floor cell={cell} alt={alt}>
          <ExitMark cell={cell} />
        </Floor>
      );
    case 'switch': {
      const c = colors.groups[tile.group ?? 'a'];
      const on = toggled.includes(tile.group ?? '');
      const s = cell * 0.44;
      return (
        <Floor cell={cell} alt={alt}>
          <View
            style={{
              width: s,
              height: s,
              borderRadius: s,
              borderWidth: Math.max(2, cell * 0.06),
              borderColor: c,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View style={{ width: s * 0.38, height: s * 0.38, borderRadius: s, backgroundColor: on ? c : 'transparent' }} />
          </View>
        </Floor>
      );
    }
    case 'door': {
      const c = colors.groups[tile.group ?? 'a'];
      const open = isDoorOpen(tile, toggled);
      if (open) {
        return (
          <Floor cell={cell} alt={alt}>
            <View
              style={{
                width: cell * 0.7,
                height: cell * 0.7,
                borderRadius: cell * 0.1,
                borderWidth: 1.5,
                borderStyle: 'dashed',
                borderColor: c,
                opacity: 0.55,
              }}
            />
          </Floor>
        );
      }
      return (
        <View
          style={{
            position: 'absolute',
            left: cell * 0.06,
            top: cell * 0.06,
            right: cell * 0.06,
            bottom: cell * 0.06,
            borderRadius: cell * 0.12,
            backgroundColor: colors.wall,
            borderWidth: Math.max(2, cell * 0.06),
            borderColor: c,
            alignItems: 'center',
            justifyContent: 'center',
            gap: cell * 0.08,
          }}
        >
          {[0, 1, 2].map((k) => (
            <View key={k} style={{ width: cell * 0.5, height: Math.max(1.5, cell * 0.05), backgroundColor: c, opacity: 0.6, borderRadius: 2 }} />
          ))}
        </View>
      );
    }
    case 'crumble':
      if (collapsed) {
        return (
          <View
            style={{
              position: 'absolute',
              left: cell * 0.1,
              top: cell * 0.1,
              right: cell * 0.1,
              bottom: cell * 0.1,
              borderRadius: cell * 0.12,
              backgroundColor: '#05070B',
              borderWidth: 1,
              borderColor: colors.border,
            }}
          />
        );
      }
      return (
        <Floor cell={cell} alt={alt}>
          <View style={{ width: cell * 0.62, height: cell * 0.62, flexDirection: 'row', flexWrap: 'wrap', gap: cell * 0.06 }}>
            {[0, 1, 2, 3].map((k) => (
              <View key={k} style={{ width: cell * 0.28, height: cell * 0.28, borderRadius: cell * 0.05, backgroundColor: colors.wall, opacity: 0.8 }} />
            ))}
          </View>
        </Floor>
      );
    case 'oneway':
      return (
        <Floor cell={cell} alt={alt}>
          <Arrow dir={tile.dir ?? 'up'} size={cell * 0.5} color={colors.textDim} />
        </Floor>
      );
    case 'silence': {
      const s = cell * 0.6;
      return (
        <Floor cell={cell} alt={alt}>
          <View style={{ width: s, height: s, borderRadius: s, borderWidth: 1, borderColor: colors.echo, opacity: 0.25, position: 'absolute' }} />
          <View style={{ width: s * 0.6, height: s * 0.6, borderRadius: s, borderWidth: 1, borderColor: colors.echo, opacity: 0.4, position: 'absolute' }} />
          <View style={{ width: s * 0.9, height: 2, backgroundColor: colors.textDim, transform: [{ rotate: '-45deg' }] }} />
        </Floor>
      );
    }
    default:
      return <Floor cell={cell} alt={alt} />;
  }
}

function ExitMark({ cell }: { cell: number }) {
  const pulse = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const s = cell * 0.62;
  return (
    <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={{
          position: 'absolute',
          width: s,
          height: s,
          borderRadius: cell * 0.1,
          backgroundColor: colors.exitGlow,
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.9] }),
          transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.08] }) }],
        }}
      />
      <View
        style={{
          width: s * 0.5,
          height: s * 0.5,
          borderWidth: Math.max(2, cell * 0.05),
          borderColor: colors.exit,
          transform: [{ rotate: '45deg' }],
        }}
      />
    </View>
  );
}

/* ---------------- player piece + echo effects ---------------- */

function Piece({
  state,
  cell,
  nextEcho,
  version,
  hintDir,
}: {
  state: GameState;
  cell: number;
  nextEcho?: Direction;
  version: number;
  hintDir?: Direction;
}) {
  const pos = useState(() => new Animated.ValueXY({ x: state.player.x * cell, y: state.player.y * cell }))[0];
  const echoGlow = useState(() => new Animated.Value(0))[0];
  const ghostOpacity = useState(() => new Animated.Value(0))[0];
  const ghostPos = useState(() => new Animated.ValueXY({ x: 0, y: 0 }))[0];
  const lastCell = useRef(cell);

  useEffect(() => {
    const steps = state.lastSteps;
    const target = { x: state.player.x * cell, y: state.player.y * cell };
    pos.stopAnimation();
    if (lastCell.current !== cell || steps.length === 0) {
      lastCell.current = cell;
      pos.setValue(target);
      return;
    }
    const first = steps[0];
    pos.setValue({ x: first.from.x * cell, y: first.from.y * cell });
    const anims = steps.map((s) => stepAnimation(s, cell, pos, echoGlow, ghostOpacity, ghostPos));
    Animated.sequence(anims).start(({ finished }) => {
      if (!finished) pos.setValue(target);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, cell]);

  const size = cell * 0.62;
  const off = (cell - size) / 2;
  return (
    <>
      {/* echo ghost: the trail left by a repeated move */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: off,
          top: off,
          width: size,
          height: size,
          borderRadius: cell * 0.14,
          borderWidth: 2,
          borderColor: colors.echo,
          opacity: ghostOpacity,
          transform: ghostPos.getTranslateTransform(),
        }}
      />
      <Animated.View
        pointerEvents="none"
        style={{ position: 'absolute', left: 0, top: 0, width: cell, height: cell, transform: pos.getTranslateTransform() }}
      >
        <Animated.View
          style={{
            position: 'absolute',
            left: off - cell * 0.08,
            top: off - cell * 0.08,
            width: size + cell * 0.16,
            height: size + cell * 0.16,
            borderRadius: cell * 0.2,
            backgroundColor: colors.echoGlow,
            opacity: echoGlow,
            transform: [{ scale: echoGlow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] }) }],
          }}
        />
        <View
          style={{
            position: 'absolute',
            left: off,
            top: off,
            width: size,
            height: size,
            borderRadius: cell * 0.14,
            backgroundColor: colors.player,
            shadowColor: colors.player,
            shadowOpacity: 0.7,
            shadowRadius: cell * 0.25,
            shadowOffset: { width: 0, height: 0 },
            elevation: 8,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View style={{ width: size * 0.28, height: size * 0.28, borderRadius: size, backgroundColor: 'rgba(255,255,255,0.85)' }} />
        </View>
        {nextEcho && state.status === 'playing' && nextEcho !== hintDir ? <EchoHint dir={nextEcho} cell={cell} /> : null}
        {hintDir && state.status === 'playing' ? <HintArrow dir={hintDir} cell={cell} /> : null}
      </Animated.View>
    </>
  );
}

/** Ghost squares showing where the considered move (and its echo) would leave the piece. */
function GhostPreview({ preview, cell }: { preview: MovePreview; cell: number }) {
  const size = cell * 0.62;
  const own = preview.steps[0];
  const ghost = (pos: Vec, color: string, dashed: boolean, key: string) => {
    // the final ghost is drawn slightly larger so it stays visible around the piece
    const s = dashed ? size : cell * 0.8;
    const o = (cell - s) / 2;
    return (
    <View
      key={key}
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: pos.x * cell + o,
        top: pos.y * cell + o,
        width: s,
        height: s,
        borderRadius: cell * 0.14,
        borderWidth: 2,
        borderStyle: dashed ? 'dashed' : 'solid',
        borderColor: color,
        backgroundColor: dashed ? 'transparent' : 'rgba(45,226,255,0.10)',
      }}
    />
    );
  };
  const finalColor = preview.status === 'won' ? colors.exit : colors.echo;
  const echoMoved = !samePos(own.to, preview.final);
  return (
    <>
      {echoMoved || preview.steps.length > 1 ? ghost(own.to, colors.player, true, 'own') : null}
      {ghost(preview.final, echoMoved || preview.status === 'won' ? finalColor : colors.player, false, 'final')}
    </>
  );
}

/** Pulsing orange chevron suggesting the next move. */
function HintArrow({ dir, cell }: { dir: Direction; cell: number }) {
  const [t] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [t]);
  const d = delta(dir);
  const s = cell * 0.42;
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: cell / 2 - s / 2 + d.x * cell * 0.62,
        top: cell / 2 - s / 2 + d.y * cell * 0.62,
        opacity: t.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }),
        transform: [
          { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, d.x * cell * 0.08] }) },
          { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, d.y * cell * 0.08] }) },
        ],
      }}
    >
      <Arrow dir={dir} size={s} color={colors.player} />
    </Animated.View>
  );
}

/** Small cyan chevron on the side of the piece: where the next echo will push. */
function EchoHint({ dir, cell }: { dir: Direction; cell: number }) {
  const d = delta(dir);
  const s = cell * 0.3;
  return (
    <View
      style={{
        position: 'absolute',
        left: cell / 2 - s / 2 + d.x * cell * 0.44,
        top: cell / 2 - s / 2 + d.y * cell * 0.44,
        opacity: 0.9,
      }}
    >
      <Arrow dir={dir} size={s} color={colors.echo} />
    </View>
  );
}

function stepAnimation(
  s: StepEvent,
  cell: number,
  pos: Animated.ValueXY,
  echoGlow: Animated.Value,
  ghostOpacity: Animated.Value,
  ghostPos: Animated.ValueXY,
): Animated.CompositeAnimation {
  const from: Vec = { x: s.from.x * cell, y: s.from.y * cell };
  const isEcho = s.actor === 'echo';
  const duration = isEcho ? motion.echoStep : motion.step;

  if (s.blocked) {
    const d = delta(s.dir);
    const nudge = { x: from.x + d.x * cell * 0.12, y: from.y + d.y * cell * 0.12 };
    return Animated.sequence([
      Animated.delay(isEcho ? 60 : 0),
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pos, { toValue: nudge, duration: motion.bump / 2, useNativeDriver: true }),
          Animated.timing(pos, { toValue: from, duration: motion.bump / 2, useNativeDriver: true }),
        ]),
        isEcho ? pulse(echoGlow, 0.6) : Animated.delay(0),
      ]),
    ]);
  }

  const to = { x: s.to.x * cell, y: s.to.y * cell };
  const move = Animated.timing(pos, {
    toValue: to,
    duration,
    easing: Easing.out(Easing.cubic),
    useNativeDriver: true,
  });
  if (!isEcho) return move;

  return Animated.sequence([
    Animated.delay(50),
    Animated.parallel([
      move,
      pulse(echoGlow, 1),
      Animated.sequence([
        Animated.timing(ghostPos, { toValue: from, duration: 0, useNativeDriver: true }),
        Animated.timing(ghostOpacity, { toValue: 0.9, duration: 0, useNativeDriver: true }),
        Animated.timing(ghostOpacity, { toValue: 0, duration: 420, useNativeDriver: true }),
      ]),
    ]),
  ]);
}

function pulse(v: Animated.Value, peak: number) {
  return Animated.sequence([
    Animated.timing(v, { toValue: peak, duration: 80, useNativeDriver: true }),
    Animated.timing(v, { toValue: 0, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }),
  ]);
}

export const styles = StyleSheet.create({});
