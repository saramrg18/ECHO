/* eslint-disable react-hooks/immutability, react-hooks/refs --
 * react-three-fiber idiom: three.js objects and the match state are mutated inside the frame loop
 * on purpose, outside React's render cycle. */
/**
 * The 3D sea: two islands with lighthouses, three sandbars between them, animated tide water,
 * and the creatures, boats and buildings of the match. The simulation itself runs here, in the
 * frame loop, so it stays in step with what you see.
 */
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import React, { memo, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import * as THREE from 'three';
import {
  aiThink,
  drainEvents,
  seaById,
  step,
  type AiBrain,
  type Lane,
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
  lighthouseGeometry,
  material,
  palmGeometry,
  rockGeometry,
  trapGeometry,
  unitGeometry,
  wallGeometry,
} from './models';

export const LANE_X = [-2.5, 0, 2.5];
const HALF = 7;
const LANE_LEN = HALF * 2;
const LANE_W = 1.5;
const WATER_LOW = -0.34;
const WATER_HIGH = 0.3;
const ISLAND_TOP = 0.45;
const ISLAND_Z = 9.9;
const LIGHTHOUSE_Z = 10.4;

export const zOf = (d: number) => HALF - LANE_LEN * d;
const waterY = (w: number) => WATER_LOW + (WATER_HIGH - WATER_LOW) * smooth(w);
const smooth = (t: number) => t * t * (3 - 2 * t);
/** Ground height along a lane: rises onto the island beaches at both ends. */
function groundY(d: number) {
  const e = Math.min(d, 1 - d);
  if (e >= 0.075) return 0;
  return ISLAND_TOP * smooth(Math.min(1, (0.075 - e) / 0.03));
}

export interface SceneProps {
  state: React.RefObject<MatchState>;
  sea: SeaId;
  /** Brains that play each side. The player's is only set for the menu demo. */
  brains: Partial<Record<Side, AiBrain>>;
  /** Show the lanes as tappable, coloured for this kind of card. */
  selecting: 'unit' | 'build' | 'spell' | null;
  onLaneTap?(lane: Lane): void;
  onEvents?(events: MatchEvent[]): void;
  demo?: boolean;
}

export const Scene3D = memo(function Scene3D(props: SceneProps) {
  const { sea, selecting, onLaneTap, demo } = props;
  const colors = seaById(sea).colors;
  const camRef = useRef<THREE.Camera | null>(null);
  const size = useRef({ w: 1, h: 1 });
  const box = useRef<React.ComponentRef<typeof View>>(null);
  /** Where the scene sits on screen, so a tap's page position can be turned into scene coordinates. */
  const origin = useRef({ x: 0, y: 0 });
  const measure = () =>
    box.current?.measureInWindow((x, y, w, h) => {
      origin.current = { x, y };
      if (w > 0 && h > 0) size.current = { w, h };
    });

  const onLayout = (e: LayoutChangeEvent) => {
    size.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height };
    measure();
  };

  const onRelease = (e: GestureResponderEvent) => {
    const cam = camRef.current;
    if (!cam || !selecting || !onLaneTap) return;
    // Page coordinates are reliable whichever child view (the GL canvas) was touched.
    const locationX = e.nativeEvent.pageX - origin.current.x;
    const locationY = e.nativeEvent.pageY - origin.current.y;
    const ndc = new THREE.Vector2((locationX / size.current.w) * 2 - 1, -(locationY / size.current.h) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, cam);
    const p = new THREE.Vector3();
    if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p)) return;
    let best = 0;
    for (let i = 1; i < 3; i++) if (Math.abs(LANE_X[i] - p.x) < Math.abs(LANE_X[best] - p.x)) best = i;
    if (Math.abs(LANE_X[best] - p.x) < 1.6 && p.z > -HALF - 2 && p.z < HALF + 3) onLaneTap(best as Lane);
  };

  return (
    <View
      ref={box}
      style={styles.fill}
      onLayout={onLayout}
      // Capture phase: the native r3f canvas claims every touch for itself, so a plain
      // onStartShouldSetResponder here never fires on a phone. While a card is selected
      // the scene takes the tap first.
      onStartShouldSetResponderCapture={() => !!selecting}
      onMoveShouldSetResponderCapture={() => !!selecting}
      onResponderTerminationRequest={() => false}
      onResponderGrant={measure}
      onResponderRelease={onRelease}
    >
      <Canvas style={styles.fill} camera={{ fov: 40, near: 0.1, far: 200, position: [0, 14, 14] }}>
        <color attach="background" args={[colors.sky]} />
        <fog attach="fog" args={[colors.sky, 30, 70]} />
        <hemisphereLight args={['#FFFFFF', '#3A6A8A', 1.5]} />
        <directionalLight position={[5, 12, 6]} intensity={1.7} />
        <CameraRig camRef={camRef} demo={!!demo} />
        <World sea={sea} />
        <Water state={props.state} sea={sea} />
        <Lighthouse side="player" state={props.state} />
        <Lighthouse side="ai" state={props.state} />
        <Structures state={props.state} />
        <Units state={props.state} />
        <Effects {...props} />
        <LaneGlow selecting={selecting} />
      </Canvas>
    </View>
  );
});

function CameraRig({ camRef, demo }: { camRef: React.RefObject<THREE.Camera | null>; demo: boolean }) {
  const { camera, size } = useThree();
  const pose = useMemo(() => {
    const aspect = size.width / Math.max(1, size.height);
    // Fit the three lanes across and both islands top to bottom.
    const t = Math.tan((20 * Math.PI) / 180);
    const needW = 4.6 / (t * aspect);
    const needH = 13.5 / t;
    const dist = Math.max(needW, needH * 0.92);
    const elev = 1.02;
    return { dist, elev };
  }, [size.width, size.height]);
  useEffect(() => {
    camRef.current = camera;
  }, [camera, camRef]);
  useFrame(({ clock }) => {
    const sway = demo ? Math.sin(clock.elapsedTime * 0.15) * 0.25 : 0;
    const { dist, elev } = pose;
    camera.position.set(
      Math.sin(sway) * dist * Math.cos(elev),
      Math.sin(elev) * dist,
      Math.cos(sway) * dist * Math.cos(elev) + 1.4,
    );
    camera.lookAt(0, 0, 1.4);
  });
  return null;
}

// ---------- static world ----------

function World({ sea }: { sea: SeaId }) {
  const c = seaById(sea).colors;
  const palms = useMemo(
    () => [
      [-4.2, 9.3, 0.9],
      [4.4, 9.7, 1.1],
      [-3.4, 11.8, 1],
      [3.2, 12.2, 0.8],
      [-4.4, -9.6, 1],
      [4.0, -9.2, 0.9],
      [-3.0, -12.0, 1.1],
      [3.6, -12.1, 0.8],
    ],
    [],
  );
  return (
    <group>
      <mesh position={[0, -1.4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[80, 24]} />
        <meshLambertMaterial color={c.deep} />
      </mesh>
      {/* Sandbars */}
      {LANE_X.map((x) => (
        <mesh key={x} position={[x, -0.7, 0]}>
          <boxGeometry args={[LANE_W, 1.4, LANE_LEN + 1]} />
          <meshLambertMaterial color={c.sand} flatShading />
        </mesh>
      ))}
      {[1, -1].map((s) => (
        <group key={s} position={[0, 0, s * ISLAND_Z]}>
          <mesh position={[0, ISLAND_TOP / 2 - 0.7, 0]} scale={[1.55, 1, 1]}>
            <cylinderGeometry args={[3.8, 4.1, ISLAND_TOP + 1.4, 9]} />
            <meshLambertMaterial color={c.sand} flatShading />
          </mesh>
          <mesh position={[0, ISLAND_TOP + 0.12, s * 1.2]} scale={[1.5, 1, 1]}>
            <cylinderGeometry args={[2.7, 3, 0.25, 9]} />
            <meshLambertMaterial color={c.grass} flatShading />
          </mesh>
        </group>
      ))}
      {palms.map(([x, z, k], i) => (
        <mesh
          key={i}
          geometry={palmGeometry()}
          material={material}
          position={[x, ISLAND_TOP + 0.2, z]}
          scale={k}
          rotation={[0, i * 1.3, 0]}
        />
      ))}
      <mesh geometry={rockGeometry()} material={material} position={[-1.25, -0.1, 3]} />
      <mesh geometry={rockGeometry()} material={material} position={[1.3, -0.15, -2.6]} rotation={[0, 2, 0]} />
      <mesh geometry={rockGeometry()} material={material} position={[-5.2, -0.2, -1]} scale={1.6} />
      <mesh
        geometry={rockGeometry()}
        material={material}
        position={[5.3, -0.2, 1.5]}
        scale={1.4}
        rotation={[0, 1, 0]}
      />
      {sea === 'arrecife' && <mesh geometry={coralGeometry()} material={material} position={[0, 0, 0]} />}
    </group>
  );
}

function Water({ state, sea }: { state: React.RefObject<MatchState>; sea: SeaId }) {
  const c = seaById(sea).colors;
  const ref = useRef<THREE.Mesh>(null);
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(40, 46, 22, 26);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);
  const base = useMemo(() => Float32Array.from(geo.getAttribute('position').array as Float32Array), [geo]);
  const mat = useMemo(
    () =>
      new THREE.MeshPhongMaterial({
        color: c.water,
        transparent: true,
        opacity: 0.82,
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
      const x = base[i];
      const z = base[i + 2];
      arr[i + 1] = Math.sin(x * 0.9 + t * 1.3) * 0.05 + Math.cos(z * 0.7 + t * 1.1) * 0.05;
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    if (ref.current) ref.current.position.y = waterY(state.current.water);
  });
  return <mesh ref={ref} geometry={geo} material={mat} />;
}

function Lighthouse({ side, state }: { side: Side; state: React.RefObject<MatchState> }) {
  const z = side === 'player' ? LIGHTHOUSE_Z : -LIGHTHOUSE_Z;
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
    <group position={[0, ISLAND_TOP + 0.1, z]} rotation={[0, side === 'player' ? Math.PI : 0, 0]}>
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
      // Boats stay in the water next to the beach instead of climbing onto it.
      const d = boat ? Math.min(0.925, Math.max(0.075, u.d)) : u.d;
      const x = LANE_X[u.lane] + u.x;
      let y = groundY(d);
      let tilt = 0;
      let roll = 0;
      if (boat) {
        const floor = groundY(d) - (u.state === 'stranded' ? 0.02 : 0.3);
        y = Math.max(floor, wy - 0.05) + Math.sin(t * 2 + v.phase) * 0.03;
        if (u.state === 'stranded') roll = 0.35;
        else roll = Math.sin(t * 1.7 + v.phase) * 0.06;
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
      v.root.position.set(x, y, zOf(d));
      v.root.rotation.set(u.side === 'player' ? -tilt : tilt, u.side === 'player' ? Math.PI : 0, roll);
      const hurt = u.hurt < 0.15 ? 1.18 : 1;
      v.body.scale.setScalar((SCALE[u.card] ?? 1) * hurt);
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
      seen.add(st.id);
      let v = views.current.get(st.id);
      if (!v) {
        const geo =
          st.kind === 'bridge'
            ? bridgeGeometry(st.side, LANE_LEN - 1.4)
            : st.kind === 'wall'
              ? wallGeometry(st.side)
              : trapGeometry(st.side);
        v = new THREE.Mesh(geo, material);
        v.userData.born = clock.elapsedTime;
        views.current.set(st.id, v);
        g.add(v);
      }
      const x = LANE_X[st.lane];
      const grow = Math.min(1, (clock.elapsedTime - v.userData.born) / 0.35);
      if (st.kind === 'bridge') {
        // Offset each side's bridge a little so both fit on one lane.
        v.position.set(x + (st.side === 'player' ? -0.06 : 0.06), WATER_HIGH + 0.18, zOf(0.5));
        v.scale.set(1, 1, grow);
        // Blink in its last seconds.
        v.visible = st.ttl > 4 || Math.sin(clock.elapsedTime * 14) > -0.3;
      } else {
        v.position.set(x, st.kind === 'wall' ? -0.05 : 0, zOf(st.d));
        v.rotation.y = st.side === 'player' ? Math.PI : 0;
        v.scale.setScalar(grow * (st.kind === 'wall' ? 0.6 + 0.4 * (st.hp / st.maxHp) : 1));
        v.visible = st.ttl > 3 || Math.sin(clock.elapsedTime * 14) > -0.3;
      }
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
  kind: MatchEvent['type'] | 'drown';
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
    const g = new THREE.CylinderGeometry(0.5, 0.5, 1.4, 10, 1, true, 0, Math.PI);
    g.rotateZ(Math.PI / 2);
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
    for (const e of events) {
      if (e.type === 'hit') {
        const p = new THREE.Vector3(LANE_X[e.lane], 0.45 + groundY(e.d), zOf(e.d));
        spawn('hit', '#FFFFFF', 0.22, p, p, fxGeo.spark);
      } else if (e.type === 'beam') {
        const from = new THREE.Vector3(
          0,
          ISLAND_TOP + 0.1 + LIGHTHOUSE_LAMP_Y,
          e.side === 'player' ? LIGHTHOUSE_Z : -LIGHTHOUSE_Z,
        );
        const to = new THREE.Vector3(LANE_X[e.lane], 0.35 + Math.max(groundY(e.d), wy), zOf(e.d));
        spawn('beam', TEAM[e.side].glow, 0.25, from, to, fxGeo.beam);
      } else if (e.type === 'death') {
        const p = new THREE.Vector3(LANE_X[e.lane], Math.max(wy, groundY(e.d)) + 0.05, zOf(e.d));
        spawn('death', e.drowned ? '#E8FBFF' : '#FFE9A8', 0.6, p, p, fxGeo.ring);
      } else if (e.type === 'boom') {
        const p = new THREE.Vector3(LANE_X[e.lane], 0.4, zOf(e.d));
        spawn('boom', '#FF9A3C', 0.45, p, p, fxGeo.spark);
      } else if (e.type === 'wave') {
        const a = new THREE.Vector3(LANE_X[e.lane], 0.1, zOf(e.side === 'player' ? 0.05 : 0.95));
        const b = new THREE.Vector3(LANE_X[e.lane], 0.1, zOf(e.side === 'player' ? 0.95 : 0.05));
        spawn('wave', '#DDF6FF', 0.9, a, b, fxGeo.wave);
      } else if (e.type === 'lighthouse') {
        const p = new THREE.Vector3(
          (Math.random() - 0.5) * 0.8,
          ISLAND_TOP + 1 + Math.random() * 2,
          e.side === 'player' ? LIGHTHOUSE_Z - 0.5 : -LIGHTHOUSE_Z + 0.5,
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
      if (f.kind === 'beam') {
        f.obj.position.copy(f.from);
        f.obj.lookAt(f.to);
        f.obj.scale.set(1, 1, f.from.distanceTo(f.to));
        f.mat.opacity = 0.9 * (1 - k);
      } else if (f.kind === 'wave') {
        f.obj.position.copy(f.from).lerp(f.to, k);
        f.obj.position.y = wy + 0.1;
        f.obj.scale.set(1, 1 + Math.sin(k * Math.PI) * 0.4, 1);
        f.mat.opacity = 0.85 * Math.sin(k * Math.PI);
      } else if (f.kind === 'death') {
        f.obj.position.copy(f.from);
        f.obj.scale.setScalar(0.6 + k * 1.4);
        f.mat.opacity = 0.9 * (1 - k);
      } else {
        f.obj.position.copy(f.from);
        f.obj.scale.setScalar(f.kind === 'boom' ? 1 + k * 5 : 0.6 + k * 1.2);
        f.mat.opacity = 1 - k;
      }
    }
    live.current = keep;
  });
  return <group ref={group} />;
}

const glowGeo = new THREE.PlaneGeometry(LANE_W + 0.2, LANE_LEN - 0.6);
glowGeo.rotateX(-Math.PI / 2);

function LaneGlow({ selecting }: { selecting: SceneProps['selecting'] }) {
  const mats = useMemo(
    () =>
      [0, 1, 2].map(
        () => new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0, depthWrite: false }),
      ),
    [],
  );
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  useEffect(() => () => mats.forEach((m) => m.dispose()), [mats]);
  useFrame(({ clock }) => {
    const target = selecting ? 0.28 + 0.12 * Math.sin(clock.elapsedTime * 6) : 0;
    const color = selecting === 'spell' ? '#B9F0FF' : selecting === 'build' ? '#FFE6A0' : '#FFFFFF';
    mats.forEach((m, i) => {
      m.color.set(color);
      m.opacity += (target - m.opacity) * 0.25;
      const r = refs.current[i];
      if (r) r.visible = m.opacity > 0.01;
    });
  });
  return (
    <>
      {LANE_X.map((x, i) => (
        <mesh
          key={x}
          ref={(r) => (refs.current[i] = r)}
          geometry={glowGeo}
          material={mats[i]}
          position={[x, WATER_HIGH + 0.12, 0]}
        />
      ))}
    </>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
