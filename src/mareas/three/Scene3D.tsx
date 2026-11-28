/* eslint-disable react-hooks/immutability, react-hooks/refs --
 * react-three-fiber idiom: three.js objects and the match state are mutated inside the frame loop
 * on purpose, outside React's render cycle. */
/**
 * The 3D archipelago: two home islands with lighthouses, small islands in between, sandbars that
 * rise and sink with the tide, animated water, and the creatures, boats and buildings of the match.
 * The simulation runs here, in the frame loop, so it stays in step with what you see.
 *
 * Taps never go through the GL canvas (on iPhone it swallows touches): each island gets a normal
 * React Native button laid over the scene at its projected screen position.
 */
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as THREE from 'three';
import {
  HOME,
  aiThink,
  drainEvents,
  islandAt,
  seaById,
  step,
  type AiBrain,
  type IslandKind,
  type MatchEvent,
  type MatchState,
  type SeaId,
  type Side,
  type Unit,
} from '../engine';
import {
  LIGHTHOUSE_LAMP_Y,
  TEAM,
  bridgeGeometry,
  coralGeometry,
  fortGeometry,
  lighthouseGeometry,
  material,
  palmGeometry,
  pearlGeometry,
  rockGeometry,
  trapGeometry,
  unitGeometry,
  wallGeometry,
} from './models';

const WATER_LOW = -0.34;
const WATER_HIGH = 0.3;
const HOME_TOP = 0.5;
const ISLE_TOP = 0.45;
const BAR_W = 1.25;
const BAR_OPEN = 0;
const BAR_HINT = -0.16;
const BAR_HIDDEN = -0.95;

const waterY = (w: number) => WATER_LOW + (WATER_HIGH - WATER_LOW) * smooth(w);
const smooth = (t: number) => t * t * (3 - 2 * t);

export type Selecting = 'unit' | 'build' | 'spell' | null;

export interface SceneProps {
  state: React.RefObject<MatchState>;
  sea: SeaId;
  /** Brains that play each side. The player's is only set for the menu demo. */
  brains: Partial<Record<Side, AiBrain>>;
  /** A card is selected: islands become tappable targets. */
  selecting: Selecting;
  onIslandTap?(island: number): void;
  onEvents?(events: MatchEvent[]): void;
  demo?: boolean;
}

interface Label {
  id: number;
  x: number;
  y: number;
  kind: IslandKind;
  owner: Side | null;
  capture: number;
  name: string;
}

export const Scene3D = memo(function Scene3D(props: SceneProps) {
  const { sea, selecting, onIslandTap, demo } = props;
  const colors = seaById(sea).colors;
  const [labels, setLabels] = useState<Label[]>([]);

  return (
    <View style={styles.fill}>
      <Canvas style={styles.fill} camera={{ fov: 40, near: 0.1, far: 200, position: [0, 14, 14] }}>
        <color attach="background" args={[colors.sky]} />
        <fog attach="fog" args={[colors.sky, 32, 75]} />
        <hemisphereLight args={['#FFFFFF', '#3A6A8A', 1.5]} />
        <directionalLight position={[5, 12, 6]} intensity={1.7} />
        <CameraRig demo={!!demo} />
        <World state={props.state} sea={sea} />
        <Bars state={props.state} sea={sea} />
        <Water state={props.state} sea={sea} />
        <Lighthouse side="player" state={props.state} />
        <Lighthouse side="ai" state={props.state} />
        <IslandProps state={props.state} />
        <Structures state={props.state} />
        <Units state={props.state} />
        <Effects {...props} />
        <TargetRings state={props.state} selecting={selecting} />
        {!demo && <Projector state={props.state} onLabels={setLabels} />}
      </Canvas>
      {!demo ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {labels.map((l) => (
            <IslandBadge key={l.id} label={l} selecting={selecting} onPress={() => onIslandTap?.(l.id)} />
          ))}
        </View>
      ) : null}
    </View>
  );
});

const KIND_ICON: Record<IslandKind, string> = { home: '🗼', energy: '💎', fort: '🏰' };

function IslandBadge({ label, selecting, onPress }: { label: Label; selecting: Selecting; onPress: () => void }) {
  const color = label.owner ? TEAM[label.owner].main : 'rgba(30,40,55,0.7)';
  const big = !!selecting;
  const size = big ? (label.kind === 'home' ? 64 : 54) : 26;
  // Home badges only matter as targets.
  if (label.kind === 'home' && !big) return null;
  return (
    <Pressable
      onPress={onPress}
      disabled={!big}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label.name}
      style={[
        styles.badge,
        {
          left: label.x - size / 2,
          top: label.y - size / 2,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: big ? 'rgba(255,255,255,0.28)' : color,
          borderColor: big ? '#FFFFFF' : 'rgba(255,255,255,0.85)',
          borderWidth: big ? 3 : 2,
        },
      ]}
    >
      {big ? (
        <Text style={styles.badgeBig}>
          {label.kind === 'home' ? (label.owner === 'player' ? '🏠' : '🎯') : KIND_ICON[label.kind]}
        </Text>
      ) : (
        <Text style={styles.badgeIcon}>{KIND_ICON[label.kind]}</Text>
      )}
      {!big && !label.owner && Math.abs(label.capture) > 0.02 ? (
        <View style={styles.captureTrack}>
          <View
            style={[
              styles.captureFill,
              {
                width: `${Math.abs(label.capture) * 100}%`,
                backgroundColor: label.capture > 0 ? TEAM.player.main : TEAM.ai.main,
              },
            ]}
          />
        </View>
      ) : null}
    </Pressable>
  );
}

function Projector({ state, onLabels }: { state: React.RefObject<MatchState>; onLabels(l: Label[]): void }) {
  const { camera, size } = useThree();
  const last = useRef('');
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const s = state.current;
    const key =
      `${camera.position.x.toFixed(2)},${camera.position.z.toFixed(2)},${size.width},${size.height}|` +
      s.islands.map((i) => `${i.owner ?? '-'}${i.capture.toFixed(1)}`).join(',');
    if (key === last.current) return;
    last.current = key;
    camera.updateMatrixWorld();
    onLabels(
      s.map.islands.map((isl, i) => {
        const top = isl.kind === 'home' ? HOME_TOP : ISLE_TOP;
        v.set(isl.x, top + (isl.kind === 'home' ? 0.6 : 1.9), isl.z).project(camera);
        return {
          id: isl.id,
          x: ((v.x + 1) / 2) * size.width,
          y: ((1 - v.y) / 2) * size.height,
          kind: isl.kind,
          owner: s.islands[i].owner,
          capture: s.islands[i].capture,
          name: isl.name,
        };
      }),
    );
  });
  return null;
}

function CameraRig({ demo }: { demo: boolean }) {
  const { camera, size } = useThree();
  const pose = useMemo(() => {
    const aspect = size.width / Math.max(1, size.height);
    const t = Math.tan((20 * Math.PI) / 180);
    // Fit the archipelago across and both homes top to bottom.
    const needW = 7 / (t * aspect);
    const needH = 14 / t;
    return { dist: Math.max(needW, needH * 0.9), elev: 1.05 };
  }, [size.width, size.height]);
  useFrame(({ clock }) => {
    const sway = demo ? Math.sin(clock.elapsedTime * 0.15) * 0.25 : 0;
    const { dist, elev } = pose;
    camera.position.set(
      Math.sin(sway) * dist * Math.cos(elev),
      Math.sin(elev) * dist,
      Math.cos(sway) * dist * Math.cos(elev) + 1.2,
    );
    camera.lookAt(0, 0, 1.2);
  });
  return null;
}

// ---------- static world ----------

function World({ state, sea }: { state: React.RefObject<MatchState>; sea: SeaId }) {
  const c = seaById(sea).colors;
  const islands = state.current.map.islands;
  const palms = useMemo(
    () => [
      [-4.2, 9.6, 0.9],
      [4.4, 9.9, 1.1],
      [-3.2, 12.2, 1],
      [3.4, 12.0, 0.8],
      [-4.4, -9.9, 1],
      [4.0, -9.5, 0.9],
      [-3.0, -12.2, 1.1],
      [3.6, -12.3, 0.8],
      [-5.2, 4.9, 0.6],
      [5.2, -4.9, 0.6],
      [0.9, 0.9, 0.6],
    ],
    [],
  );
  return (
    <group>
      <mesh position={[0, -1.4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[80, 24]} />
        <meshLambertMaterial color={c.deep} />
      </mesh>
      {islands.map((isl) => {
        const home = isl.kind === 'home';
        const top = home ? HOME_TOP : ISLE_TOP;
        return (
          <group key={isl.id} position={[isl.x, 0, isl.z]}>
            <mesh position={[0, (top - 1.4) / 2, 0]} scale={home ? [1.45, 1, 1] : [1, 1, 1]}>
              <cylinderGeometry args={[isl.r, isl.r + 0.35, top + 1.4, home ? 9 : 7]} />
              <meshLambertMaterial color={c.sand} flatShading />
            </mesh>
            <mesh
              position={[0, top + 0.08, home ? (isl.home === 'player' ? 1 : -1) : 0]}
              scale={home ? [1.45, 1, 1] : [1, 1, 1]}
            >
              <cylinderGeometry
                args={[isl.r * (home ? 0.75 : 0.62), isl.r * (home ? 0.82 : 0.7), 0.18, home ? 9 : 7]}
              />
              <meshLambertMaterial color={c.grass} flatShading />
            </mesh>
          </group>
        );
      })}
      {palms.map(([x, z, k], i) => (
        <mesh
          key={i}
          geometry={palmGeometry()}
          material={material}
          position={[x, (Math.abs(z) > 8 ? HOME_TOP : ISLE_TOP) + 0.15, z]}
          scale={k}
          rotation={[0, i * 1.3, 0]}
        />
      ))}
      <mesh geometry={rockGeometry()} material={material} position={[-6.6, -0.2, -0.6]} scale={1.6} />
      <mesh
        geometry={rockGeometry()}
        material={material}
        position={[6.6, -0.2, 1.2]}
        scale={1.4}
        rotation={[0, 1, 0]}
      />
      {sea === 'arrecife' && (
        <group>
          <mesh geometry={coralGeometry()} material={material} position={[2.2, -0.1, 0.6]} rotation={[0, 0.8, 0]} />
          <mesh geometry={coralGeometry()} material={material} position={[-2.2, -0.1, -0.6]} rotation={[0, 2.2, 0]} />
        </group>
      )}
    </group>
  );
}

/** Sandbars: raised when uncovered, faintly visible under water when they will open next. */
function Bars({ state, sea }: { state: React.RefObject<MatchState>; sea: SeaId }) {
  const c = seaById(sea).colors;
  const map = state.current.map;
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const geo = useMemo(
    () =>
      map.bars.map((b) => {
        const a = map.islands[b.a];
        const z = map.islands[b.b];
        return {
          len: Math.hypot(z.x - a.x, z.z - a.z),
          x: (a.x + z.x) / 2,
          z: (a.z + z.z) / 2,
          rot: Math.atan2(z.x - a.x, z.z - a.z),
        };
      }),
    [map],
  );
  const mat = useMemo(() => new THREE.MeshLambertMaterial({ color: c.sand, flatShading: true }), [c.sand]);
  useEffect(() => () => mat.dispose(), [mat]);
  useFrame((_, dt) => {
    const s = state.current;
    map.bars.forEach((b, i) => {
      const m = refs.current[i];
      if (!m) return;
      const open = s.openBars.includes(b.id);
      const target = !open ? BAR_HIDDEN : s.tide === 'low' ? BAR_OPEN : BAR_HINT;
      m.position.y += (target - 0.6 - m.position.y) * Math.min(1, dt * 2.5);
    });
  });
  return (
    <>
      {geo.map((g, i) => (
        <mesh
          key={i}
          ref={(r) => (refs.current[i] = r)}
          material={mat}
          position={[g.x, BAR_HIDDEN - 0.6, g.z]}
          rotation={[0, g.rot, 0]}
        >
          <boxGeometry args={[BAR_W, 1.2, g.len]} />
        </mesh>
      ))}
    </>
  );
}

function Water({ state, sea }: { state: React.RefObject<MatchState>; sea: SeaId }) {
  const c = seaById(sea).colors;
  const ref = useRef<THREE.Mesh>(null);
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(44, 50, 22, 26);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);
  const base = useMemo(() => Float32Array.from(geo.getAttribute('position').array as Float32Array), [geo]);
  const mat = useMemo(
    () =>
      new THREE.MeshPhongMaterial({
        color: c.water,
        transparent: true,
        opacity: 0.8,
        flatShading: true,
        shininess: 60,
      }),
    [c.water],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const pos = geo.getAttribute('position') as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i + 1] = Math.sin(base[i] * 0.9 + t * 1.3) * 0.05 + Math.cos(base[i + 2] * 0.7 + t * 1.1) * 0.05;
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    if (ref.current) ref.current.position.y = waterY(state.current.water);
  });
  return <mesh ref={ref} geometry={geo} material={mat} />;
}

function Lighthouse({ side, state }: { side: Side; state: React.RefObject<MatchState> }) {
  const home = state.current.map.islands[HOME[side]];
  const z = home.z + (side === 'player' ? 0.6 : -0.6);
  const beam = useRef<THREE.Group>(null);
  const lampMat = useMemo(() => new THREE.MeshBasicMaterial({ color: TEAM[side].glow }), [side]);
  const beamMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: TEAM[side].glow,
        transparent: true,
        opacity: 0.25,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [side],
  );
  const flash = useRef(0);
  const lastHp = useRef(0);
  const dark = useMemo(() => new THREE.Color('#3A3A44'), []);
  const lit = useMemo(() => new THREE.Color(TEAM[side].glow), [side]);
  const red = useMemo(() => new THREE.Color('#FF5A5A'), []);
  useEffect(
    () => () => {
      lampMat.dispose();
      beamMat.dispose();
    },
    [lampMat, beamMat],
  );
  useFrame((_, dt) => {
    const p = state.current.players[side];
    const k = p.lighthouse / p.lighthouseMax;
    if (p.lighthouse < lastHp.current) flash.current = 0.25;
    lastHp.current = p.lighthouse;
    flash.current = Math.max(0, flash.current - dt);
    lampMat.color.copy(dark).lerp(lit, k <= 0 ? 0 : 0.35 + 0.65 * k);
    if (flash.current > 0) lampMat.color.lerp(red, 0.6);
    if (beam.current) {
      beam.current.rotation.y += dt * (0.6 + k);
      beam.current.visible = k > 0;
      beamMat.opacity = 0.1 + 0.2 * k;
    }
  });
  return (
    <group position={[home.x, HOME_TOP + 0.1, z]} rotation={[0, side === 'player' ? Math.PI : 0, 0]}>
      <mesh geometry={lighthouseGeometry(side)} material={material} />
      <mesh material={lampMat} position={[0, LIGHTHOUSE_LAMP_Y, 0]}>
        <icosahedronGeometry args={[0.24, 0]} />
      </mesh>
      <group ref={beam} position={[0, LIGHTHOUSE_LAMP_Y, 0]}>
        <mesh material={beamMat} position={[2.2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <coneGeometry args={[0.7, 4.4, 8, 1, true]} />
        </mesh>
      </group>
    </group>
  );
}

/** Towers on Roca islands and clams on Perla islands, flagged with their owner's colour. */
function IslandProps({ state }: { state: React.RefObject<MatchState> }) {
  const map = state.current.map;
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const owners = useRef<(Side | null | undefined)[]>([]);
  useFrame(() => {
    const s = state.current;
    map.islands.forEach((isl, i) => {
      const m = refs.current[i];
      if (!m) return;
      const owner = s.islands[i].owner;
      if (owners.current[i] === owner) return;
      owners.current[i] = owner;
      m.geometry = isl.kind === 'fort' ? fortGeometry(owner) : pearlGeometry(owner);
    });
  });
  return (
    <>
      {map.islands.map((isl, i) =>
        isl.kind === 'home' ? null : (
          <mesh
            key={isl.id}
            ref={(r) => (refs.current[i] = r)}
            geometry={isl.kind === 'fort' ? fortGeometry(null) : pearlGeometry(null)}
            material={material}
            position={[isl.x, ISLE_TOP + 0.15, isl.z - 0.15]}
            scale={isl.r > 1.5 ? 1.25 : 1}
          />
        ),
      )}
    </>
  );
}

// ---------- units ----------

interface UnitView {
  root: THREE.Group;
  body: THREE.Mesh;
  bar: THREE.Group;
  fill: THREE.Mesh;
  phase: number;
}

const barBg = new THREE.MeshBasicMaterial({ color: '#1B1B26', depthTest: false, transparent: true, opacity: 0.7 });
const barFill: Record<Side, THREE.MeshBasicMaterial> = {
  player: new THREE.MeshBasicMaterial({ color: TEAM.player.main, depthTest: false }),
  ai: new THREE.MeshBasicMaterial({ color: TEAM.ai.main, depthTest: false }),
};
const barGeo = new THREE.PlaneGeometry(1, 1);
const SCALE: Record<string, number> = {
  cangrejos: 1.5,
  tortuga: 1.35,
  morsa: 1.3,
  pezglobo: 1.4,
  bote: 1.5,
  balandro: 1.35,
  galeon: 1.25,
};

function makeUnitView(u: Unit): UnitView {
  const root = new THREE.Group();
  const body = new THREE.Mesh(unitGeometry(u.card, u.side), material);
  body.scale.setScalar(SCALE[u.card] ?? 1);
  root.add(body);
  const bar = new THREE.Group();
  const bg = new THREE.Mesh(barGeo, barBg);
  bg.scale.set(0.6, 0.09, 1);
  bg.renderOrder = 10;
  const fill = new THREE.Mesh(barGeo, barFill[u.side]);
  fill.scale.set(0.56, 0.06, 1);
  fill.position.z = 0.001;
  fill.renderOrder = 11;
  bar.add(bg, fill);
  bar.position.y = u.kind === 'boat' ? (u.card === 'galeon' ? 2.3 : 1.5) : u.card === 'morsa' ? 1.3 : 0.9;
  root.add(bar);
  return { root, body, bar, fill, phase: (u.id * 0.37) % (Math.PI * 2) };
}

/** Height of the ground under a point: island top, an uncovered sandbar, or the sea bed. */
function groundAt(s: MatchState, x: number, z: number) {
  const isl = islandAt(s.map, x, z);
  if (isl) return isl.kind === 'home' ? HOME_TOP : ISLE_TOP;
  return BAR_OPEN;
}

function Units({ state }: { state: React.RefObject<MatchState> }) {
  const group = useRef<THREE.Group>(null);
  const views = useRef(new Map<number, UnitView>());
  const { camera } = useThree();
  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    const s = state.current;
    const t = clock.elapsedTime;
    const seen = new Set<number>();
    const wy = waterY(s.water);
    for (const u of s.units) {
      seen.add(u.id);
      let v = views.current.get(u.id);
      if (!v) {
        v = makeUnitView(u);
        views.current.set(u.id, v);
        g.add(v.root);
      }
      const boat = u.kind === 'boat';
      // Groups walk side by side on sandbars and spread out on islands.
      const ox = u.next !== null || boat ? u.ox * 0.6 : 0;
      const x = u.x + ox;
      const z = u.z;
      let y = groundAt(s, x, z);
      let tilt = 0;
      let roll = 0;
      if (boat) {
        const stranded = u.state === 'stranded';
        y = stranded ? Math.max(wy - 0.05, -0.2) : wy - 0.05 + Math.sin(t * 2 + v.phase) * 0.03;
        roll = stranded ? 0.35 : Math.sin(t * 1.7 + v.phase) * 0.06;
      } else if (u.state === 'drowning') {
        y = wy - 0.35 + Math.sin(t * 12 + v.phase) * 0.06;
        tilt = Math.sin(t * 9 + v.phase) * 0.4;
      } else if (u.amphibious && wy > y) {
        y = wy - 0.12;
      } else if (u.state === 'move') {
        y += Math.abs(Math.sin(t * 11 + v.phase)) * 0.07;
      } else if (u.state === 'fight') {
        tilt = Math.max(0, Math.sin(t * 9 + v.phase)) * 0.35;
      }
      // Face the way it is going (or the rival island when standing still).
      const prevX = v.root.position.x;
      const prevZ = v.root.position.z;
      v.root.position.set(x, y, z);
      const dx = x - prevX;
      const dz = z - prevZ;
      if (dx * dx + dz * dz > 1e-5) v.root.rotation.y = Math.atan2(dx, dz);
      else if (u.state !== 'move') v.root.rotation.y = u.side === 'player' ? Math.PI : 0;
      v.root.rotation.x = tilt;
      v.root.rotation.z = roll;
      v.body.scale.setScalar((SCALE[u.card] ?? 1) * (u.hurt < 0.15 ? 1.18 : 1));
      const k = Math.max(0, u.hp / u.maxHp);
      v.bar.visible = k < 0.999;
      v.fill.scale.x = 0.56 * k;
      v.fill.position.x = -0.28 * (1 - k);
      v.bar.quaternion.copy(v.root.quaternion).invert().multiply(camera.quaternion);
    }
    for (const [id, v] of views.current) {
      if (!seen.has(id)) {
        g.remove(v.root);
        views.current.delete(id);
      }
    }
  });
  return <group ref={group} />;
}

// ---------- structures ----------

function Structures({ state }: { state: React.RefObject<MatchState> }) {
  const group = useRef<THREE.Group>(null);
  const views = useRef(new Map<number, THREE.Object3D>());
  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    const s = state.current;
    const seen = new Set<number>();
    for (const st of s.structures) {
      if (st.kind === 'bridge') {
        // A bridge is one plank walkway per sandbar touching its island.
        for (const bar of s.map.bars) {
          if (bar.a !== st.island && bar.b !== st.island) continue;
          const key = st.id * 100 + bar.id;
          seen.add(key);
          let v = views.current.get(key);
          if (!v) {
            const a = s.map.islands[bar.a];
            const b = s.map.islands[bar.b];
            const len = Math.hypot(b.x - a.x, b.z - a.z) - a.r - b.r + 1;
            v = new THREE.Mesh(bridgeGeometry(st.side, Math.round(len * 2) / 2), material);
            v.position.set((a.x + b.x) / 2, WATER_HIGH + 0.18, (a.z + b.z) / 2);
            v.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
            v.userData.born = clock.elapsedTime;
            views.current.set(key, v);
            g.add(v);
          }
          v.scale.z = Math.min(1, (clock.elapsedTime - v.userData.born) / 0.35);
          v.visible = st.ttl > 4 || Math.sin(clock.elapsedTime * 14) > -0.3;
        }
        continue;
      }
      seen.add(st.id);
      let v = views.current.get(st.id);
      if (!v) {
        v = new THREE.Mesh(st.kind === 'wall' ? wallGeometry(st.side) : trapGeometry(st.side), material);
        v.userData.born = clock.elapsedTime;
        views.current.set(st.id, v);
        g.add(v);
      }
      const isl = s.map.islands[st.island];
      const top = isl.kind === 'home' ? HOME_TOP : ISLE_TOP;
      const grow = Math.min(1, (clock.elapsedTime - v.userData.born) / 0.35);
      v.position.set(st.x, top, st.z + (st.kind === 'trap' ? 0.5 : 0));
      v.rotation.y = st.side === 'player' ? Math.PI : 0;
      v.scale.setScalar(grow * (st.kind === 'wall' ? 0.6 + 0.4 * (st.hp / st.maxHp) : 0.8));
      v.visible = st.ttl > 3 || Math.sin(clock.elapsedTime * 14) > -0.3;
    }
    for (const [id, v] of views.current) {
      if (!seen.has(id)) {
        g.remove(v);
        views.current.delete(id);
      }
    }
  });
  return <group ref={group} />;
}

// ---------- simulation driver and effects ----------

interface Fx {
  obj: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  age: number;
  life: number;
  kind: MatchEvent['type'];
  from: THREE.Vector3;
  to: THREE.Vector3;
}

const fxGeo = {
  spark: new THREE.IcosahedronGeometry(0.16, 0),
  ring: (() => {
    const g = new THREE.RingGeometry(0.3, 0.55, 10);
    g.rotateX(-Math.PI / 2);
    return g;
  })(),
  beam: (() => {
    const g = new THREE.CylinderGeometry(0.06, 0.06, 1, 6, 1, true);
    g.translate(0, 0.5, 0);
    g.rotateX(Math.PI / 2);
    return g;
  })(),
  wave: (() => {
    const g = new THREE.RingGeometry(0.8, 1.3, 16);
    g.rotateX(-Math.PI / 2);
    return g;
  })(),
};

function Effects({ state, brains, onEvents, demo }: SceneProps) {
  const group = useRef<THREE.Group>(null);
  const live = useRef<Fx[]>([]);
  const onEventsRef = useRef(onEvents);
  onEventsRef.current = onEvents;

  const spawn = (
    kind: Fx['kind'],
    color: string,
    life: number,
    from: THREE.Vector3,
    to: THREE.Vector3,
    geo: THREE.BufferGeometry,
  ) => {
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const obj = new THREE.Mesh(geo, mat);
    group.current?.add(obj);
    live.current.push({ obj, mat, age: 0, life, kind, from, to });
  };

  useFrame((_, rawDt) => {
    const s = state.current;
    const dt = Math.min(rawDt, 0.1);
    for (const side of ['player', 'ai'] as Side[]) {
      const b = brains[side];
      if (b) aiThink(s, b, dt, side);
    }
    step(s, dt);
    if (demo && s.result) return;
    const events = drainEvents(s);
    if (events.length && onEventsRef.current) onEventsRef.current(events);
    const wy = waterY(s.water);
    const y = (x: number, z: number) => Math.max(groundAt(s, x, z), wy);
    for (const e of events) {
      if (e.type === 'hit') {
        const p = new THREE.Vector3(e.x, y(e.x, e.z) + 0.45, e.z);
        spawn('hit', '#FFFFFF', 0.22, p, p, fxGeo.spark);
      } else if (e.type === 'beam') {
        const home = s.map.islands[HOME[e.side]];
        const tall = e.tall;
        const from = new THREE.Vector3(
          e.fromX,
          tall ? HOME_TOP + 0.1 + LIGHTHOUSE_LAMP_Y : ISLE_TOP + 1.1,
          tall ? home.z + (e.side === 'player' ? 0.6 : -0.6) : e.fromZ,
        );
        const to = new THREE.Vector3(e.x, y(e.x, e.z) + 0.35, e.z);
        spawn('beam', TEAM[e.side].glow, 0.25, from, to, fxGeo.beam);
      } else if (e.type === 'death') {
        const p = new THREE.Vector3(e.x, y(e.x, e.z) + 0.05, e.z);
        spawn('death', e.drowned ? '#E8FBFF' : '#FFE9A8', 0.6, p, p, fxGeo.ring);
      } else if (e.type === 'boom') {
        const p = new THREE.Vector3(e.x, y(e.x, e.z) + 0.4, e.z);
        spawn('boom', '#FF9A3C', 0.45, p, p, fxGeo.spark);
      } else if (e.type === 'wave') {
        const p = new THREE.Vector3(e.x, wy + 0.1, e.z);
        spawn('wave', '#DDF6FF', 0.9, p, p, fxGeo.wave);
      } else if (e.type === 'capture') {
        const isl = s.map.islands[e.island];
        const p = new THREE.Vector3(isl.x, ISLE_TOP + 0.1, isl.z);
        spawn('capture', TEAM[e.side].main, 0.8, p, p, fxGeo.wave);
      } else if (e.type === 'lighthouse') {
        const home = s.map.islands[HOME[e.side]];
        const p = new THREE.Vector3(
          home.x + (Math.random() - 0.5) * 0.8,
          HOME_TOP + 1 + Math.random() * 2,
          home.z + (e.side === 'player' ? 0.1 : -0.1),
        );
        spawn('hit', '#FFD27A', 0.25, p, p, fxGeo.spark);
      }
    }
    const keep: Fx[] = [];
    for (const f of live.current) {
      f.age += dt;
      const k = f.age / f.life;
      if (k >= 1) {
        group.current?.remove(f.obj);
        f.mat.dispose();
        continue;
      }
      keep.push(f);
      f.obj.position.copy(f.from);
      if (f.kind === 'beam') {
        f.obj.lookAt(f.to);
        f.obj.scale.set(1, 1, f.from.distanceTo(f.to));
        f.mat.opacity = 0.9 * (1 - k);
      } else if (f.kind === 'wave' || f.kind === 'capture') {
        f.obj.scale.setScalar(0.8 + k * 2.4);
        f.mat.opacity = 0.85 * (1 - k);
      } else if (f.kind === 'death') {
        f.obj.scale.setScalar(0.6 + k * 1.4);
        f.mat.opacity = 0.9 * (1 - k);
      } else {
        f.obj.scale.setScalar(f.kind === 'boom' ? 1 + k * 5 : 0.6 + k * 1.2);
        f.mat.opacity = 1 - k;
      }
    }
    live.current = keep;
  });
  return <group ref={group} />;
}

/** Pulsing rings around every island while a card is selected. */
function TargetRings({ state, selecting }: { state: React.RefObject<MatchState>; selecting: Selecting }) {
  const map = state.current.map;
  const mat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0, depthWrite: false }),
    [],
  );
  const geo = useMemo(() => {
    const g = new THREE.RingGeometry(0.92, 1.05, 32);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);
  const group = useRef<THREE.Group>(null);
  useEffect(() => () => mat.dispose(), [mat]);
  useFrame(({ clock }) => {
    const target = selecting ? 0.55 + 0.3 * Math.sin(clock.elapsedTime * 6) : 0;
    mat.opacity += (target - mat.opacity) * 0.25;
    if (group.current) group.current.visible = mat.opacity > 0.01;
  });
  return (
    <group ref={group}>
      {map.islands.map((isl) => (
        <mesh
          key={isl.id}
          geometry={geo}
          material={mat}
          position={[isl.x, (isl.kind === 'home' ? HOME_TOP : ISLE_TOP) + 0.12, isl.z]}
          scale={[(isl.r + 0.25) * (isl.kind === 'home' ? 1.35 : 1), 1, isl.r + 0.25]}
        />
      ))}
    </group>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  badge: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  badgeIcon: { fontSize: 13 },
  badgeBig: { fontSize: 26 },
  captureTrack: {
    position: 'absolute',
    bottom: -7,
    width: 30,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.45)',
    overflow: 'hidden',
  },
  captureFill: { height: '100%' },
});
