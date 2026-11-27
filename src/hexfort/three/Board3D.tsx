/* eslint-disable react-hooks/immutability, react-hooks/refs --
 * react-three-fiber idiom: three.js objects and refs are mutated inside the frame loop and
 * gesture handlers on purpose, outside React's render cycle. */
/**
 * The 3D board: low-poly hex tiles, towers and little soldiers, a camera you can rotate,
 * tap picking, troop-count labels and short battle effects.
 */
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import * as THREE from 'three';
import { hexToWorld, worldToHex, hexId, type Cell, type GameEvent, type MatchState, type Terrain } from '../engine';
import {
  TEAM,
  buildingGeometry,
  crystalGeometry,
  material,
  projectileGeometry,
  rockGeometry,
  soldierGeometry,
  treeGeometry,
} from './models';

export type Highlight = 'move' | 'attack' | 'card' | 'info';

const SIZE = 1;
const TILE_R = 0.95;
const HEIGHT: Record<Terrain, number> = {
  plain: 0.3,
  forest: 0.36,
  hill: 0.62,
  water: 0.08,
};
const TOP: Record<Terrain, string> = {
  plain: '#8BD45E',
  forest: '#5DB04C',
  hill: '#A7B86A',
  water: '#3FB5E8',
};
const HL_COLOR: Record<Highlight, string> = {
  move: '#FFFFFF',
  attack: '#FFC400',
  card: '#4DF0FF',
  info: '#FFFFFF',
};

const tileGeo = new THREE.CylinderGeometry(TILE_R, TILE_R, 1, 6);
tileGeo.translate(0, -0.5, 0);
const ringGeo = new THREE.RingGeometry(0.62, 0.92, 6, 1, Math.PI / 6);
ringGeo.rotateX(-Math.PI / 2);
const capGeo = new THREE.CylinderGeometry(TILE_R * 0.86, TILE_R * 0.86, 0.04, 6);
const sideMat = new THREE.MeshLambertMaterial({
  color: '#8A5A3C',
  flatShading: true,
});
const waterSide = new THREE.MeshLambertMaterial({
  color: '#2B86B8',
  flatShading: true,
});
const shieldGeo = new THREE.SphereGeometry(0.85, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
const shieldMat = new THREE.MeshBasicMaterial({
  color: '#8FE9FF',
  transparent: true,
  opacity: 0.22,
  depthWrite: false,
});

export interface Fx {
  id: number;
  event: GameEvent;
}

interface Props {
  state: MatchState;
  selected?: string | null;
  highlights: Record<string, Highlight>;
  fx: Fx[];
  onTap(cellId: string | null): void;
  showZoom?: boolean;
  /** Showcase mode: slow spin, no troop labels. */
  showcase?: boolean;
}

interface Orbit {
  azimuth: number;
  elevation: number;
  distance: number;
}

export function Board3D({ state, selected, highlights, fx, onTap, showZoom = true, showcase = false }: Props) {
  const radius = useMemo(
    () => Math.max(...state.order.map((id) => Math.abs(state.cells[id].r))),
    [state.order, state.cells],
  );
  const orbit = useRef<Orbit>({ azimuth: 0, elevation: 0.92, distance: 1 });
  const camRef = useRef<THREE.Camera | null>(null);
  const size = useRef({ w: 1, h: 1 });
  const [labels, setLabels] = useState<LabelPos[]>([]);

  const pick = useCallback(
    (x: number, y: number) => {
      const cam = camRef.current;
      if (!cam) return;
      const ndc = new THREE.Vector2((x / size.current.w) * 2 - 1, -(y / size.current.h) * 2 + 1);
      const ray = new THREE.Raycaster();
      ray.setFromCamera(ndc, cam);
      // Test against each tile's top plane, from the highest terrain down.
      for (const h of [HEIGHT.hill, HEIGHT.forest, HEIGHT.plain]) {
        const p = new THREE.Vector3();
        if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -h), p)) continue;
        const hex = worldToHex(p.x, p.z, SIZE);
        const cell = state.cells[hexId(hex.q, hex.r)];
        if (cell && Math.abs(HEIGHT[cell.terrain] - h) < 0.01) return onTap(cell.id);
      }
      const p = new THREE.Vector3();
      if (ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -HEIGHT.plain), p)) {
        const hex = worldToHex(p.x, p.z, SIZE);
        const id = hexId(hex.q, hex.r);
        return onTap(state.cells[id] ? id : null);
      }
      onTap(null);
    },
    [onTap, state.cells],
  );

  const gesture = useRef({
    moved: false,
    pinch: 0,
    start: { ...orbit.current },
  });
  const pickRef = useRef(pick);
  pickRef.current = pick;
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderGrant: () => {
          gesture.current = {
            moved: false,
            pinch: 0,
            start: { ...orbit.current },
          };
        },
        onPanResponderMove: (e, g) => {
          const touches = e.nativeEvent.touches;
          if (touches && touches.length >= 2) {
            const d = Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY);
            if (!gesture.current.pinch) gesture.current.pinch = d;
            const k = gesture.current.pinch / d;
            orbit.current.distance = clamp(gesture.current.start.distance * k, ZOOM_MIN, ZOOM_MAX);
            gesture.current.moved = true;
            return;
          }
          if (Math.abs(g.dx) + Math.abs(g.dy) > 8) gesture.current.moved = true;
          if (!gesture.current.moved) return;
          orbit.current.azimuth = gesture.current.start.azimuth - g.dx * 0.008;
          orbit.current.elevation = clamp(gesture.current.start.elevation + g.dy * 0.005, 0.45, 1.4);
        },
        onPanResponderRelease: (e) => {
          if (!gesture.current.moved) pickRef.current(e.nativeEvent.locationX, e.nativeEvent.locationY);
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [],
  );

  const onLayout = (e: LayoutChangeEvent) => {
    size.current = {
      w: e.nativeEvent.layout.width,
      h: e.nativeEvent.layout.height,
    };
  };

  const zoom = (k: number) => (orbit.current.distance = clamp(orbit.current.distance * k, ZOOM_MIN, ZOOM_MAX));

  return (
    <View style={styles.fill} onLayout={onLayout}>
      <View style={styles.fill} {...pan.panHandlers}>
        <Canvas style={styles.fill} camera={{ fov: FOV, near: 0.1, far: 200, position: [0, 10, 10] }}>
          <color attach="background" args={['#7EC8F0']} />
          <fog attach="fog" args={['#7EC8F0', 25, 60]} />
          <hemisphereLight args={['#FFFFFF', '#5A7A4A', 1.6]} />
          <directionalLight position={[6, 12, 8]} intensity={1.6} />
          <CameraRig orbit={orbit} camRef={camRef} radius={radius} spin={showcase} />
          <Ground radius={radius} />
          {state.order.map((id) => (
            <Tile key={id} cell={state.cells[id]} selected={selected === id} highlight={highlights[id]} />
          ))}
          <Effects fx={fx} />
          {!showcase && <Projector state={state} onLabels={setLabels} />}
        </Canvas>
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {labels.map((l) => (
            <TroopLabel key={l.id} label={l} />
          ))}
        </View>
      </View>
      {showZoom && (
        <View style={styles.zoom} pointerEvents="box-none">
          <ZoomButton label="+" onPress={() => zoom(0.85)} />
          <ZoomButton label="−" onPress={() => zoom(1.18)} />
        </View>
      )}
    </View>
  );
}

function ZoomButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Text accessibilityRole="button" onPress={onPress} style={styles.zoomBtn}>
      {label}
    </Text>
  );
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const ZOOM_MIN = 0.4;
const ZOOM_MAX = 1.5;
const FOV = 42;

function CameraRig({
  orbit,
  camRef,
  radius,
  spin,
}: {
  orbit: React.RefObject<Orbit>;
  camRef: React.RefObject<THREE.Camera | null>;
  radius: number;
  spin: boolean;
}) {
  const { camera, size } = useThree();
  // Distance at which the whole board fits the screen, in portrait or landscape.
  const fit = useMemo(() => {
    const t = Math.tan(((FOV / 2) * Math.PI) / 180);
    const aspect = size.width / Math.max(1, size.height);
    const halfW = Math.sqrt(3) * (radius + 0.5) + 0.2;
    const halfD = 1.5 * radius + 1.2;
    return Math.max((halfW / (t * aspect)) * 0.9, (halfD * 0.75) / t) + 0.5;
  }, [size.width, size.height, radius]);
  const cur = useRef({ ...orbit.current });
  useEffect(() => {
    camRef.current = camera;
  }, [camera, camRef]);
  useFrame((_, dt) => {
    const o = orbit.current;
    if (spin) o.azimuth += dt * 0.12;
    const k = Math.min(1, dt * 10);
    cur.current.azimuth += (o.azimuth - cur.current.azimuth) * k;
    cur.current.elevation += (o.elevation - cur.current.elevation) * k;
    cur.current.distance += (o.distance - cur.current.distance) * k;
    const { azimuth, elevation } = cur.current;
    const distance = cur.current.distance * fit;
    camera.position.set(
      Math.sin(azimuth) * Math.cos(elevation) * distance,
      Math.sin(elevation) * distance,
      Math.cos(azimuth) * Math.cos(elevation) * distance + 0.4,
    );
    camera.lookAt(0, 0, 0.4);
  });
  return null;
}

function Ground({ radius }: { radius: number }) {
  return (
    <group>
      <mesh position={[0, -0.75, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[60, 24]} />
        <meshLambertMaterial color="#2F9BD6" />
      </mesh>
      <mesh position={[0, -0.7, 0]}>
        <cylinderGeometry args={[radius * 1.9 + 1.6, radius * 1.9 + 2.2, 0.3, 6]} />
        <meshLambertMaterial color="#E8D39A" flatShading />
      </mesh>
    </group>
  );
}

// ---------- tiles ----------

function ownerTop(cell: Cell): THREE.Color {
  const base = new THREE.Color(TOP[cell.terrain]);
  if (cell.owner === 'neutral' || cell.terrain === 'water') return base;
  return base.lerp(new THREE.Color(TEAM[cell.owner].main), 0.55);
}

function Tile({ cell, selected, highlight }: { cell: Cell; selected: boolean; highlight?: Highlight }) {
  const group = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const { x, z } = hexToWorld(cell, SIZE);
  const h = HEIGHT[cell.terrain];
  const topMat = useMemo(
    () =>
      new THREE.MeshLambertMaterial({
        color: TOP[cell.terrain],
        flatShading: true,
      }),
    [cell.terrain],
  );
  const capMat = useMemo(() => new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true }), []);
  const ringMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [],
  );
  const target = useMemo(() => ownerTop(cell), [cell]);
  const seed = useMemo(() => (Math.abs((cell.q * 73856093) ^ (cell.r * 19349663)) % 1000) / 1000, [cell.q, cell.r]);

  useEffect(
    () => () => {
      topMat.dispose();
      capMat.dispose();
      ringMat.dispose();
    },
    [topMat, capMat, ringMat],
  );

  useFrame(({ clock }, dt) => {
    const k = Math.min(1, dt * 6);
    capMat.color.lerp(target, k);
    if (group.current) {
      const lift = selected ? 0.22 : 0;
      group.current.position.y += (lift - group.current.position.y) * Math.min(1, dt * 12);
    }
    if (ring.current) {
      const t = clock.elapsedTime;
      ringMat.color.set(highlight ? HL_COLOR[highlight] : '#FFFFFF');
      const show = selected ? 0.95 : highlight ? 0.7 + 0.25 * Math.sin(t * 5) : 0;
      ringMat.opacity += (show - ringMat.opacity) * Math.min(1, dt * 10);
      ring.current.visible = ringMat.opacity > 0.02;
    }
  });

  const isWater = cell.terrain === 'water';
  return (
    <group position={[x, 0, z]}>
      <group ref={group}>
        <mesh
          geometry={tileGeo}
          material={[isWater ? waterSide : sideMat, topMat, sideMat]}
          scale={[1, h + 0.7, 1]}
          position={[0, h, 0]}
        />
        {!isWater && <mesh geometry={capGeo} material={capMat} position={[0, h + 0.02, 0]} />}
        <mesh ref={ring} geometry={ringGeo} material={ringMat} position={[0, h + 0.05, 0]} />
        {cell.terrain === 'forest' && <Decor kind="tree" h={h} seed={seed} hasBuilding={!!cell.building} />}
        {cell.terrain === 'hill' && <Decor kind="rock" h={h} seed={seed} hasBuilding={!!cell.building} />}
        {cell.building && <Building cell={cell} h={h} />}
        {!isWater && <Troops cell={cell} h={h} seed={seed} />}
        {cell.shielded && <mesh geometry={shieldGeo} material={shieldMat} position={[0, h, 0]} />}
      </group>
    </group>
  );
}

function Decor({
  kind,
  h,
  seed,
  hasBuilding,
}: {
  kind: 'tree' | 'rock';
  h: number;
  seed: number;
  hasBuilding: boolean;
}) {
  const geo = kind === 'tree' ? treeGeometry() : rockGeometry();
  const spots = hasBuilding
    ? [[0.62, 0.2]]
    : [
        [0.55, 0.3],
        [-0.5, -0.35],
        [0.1, -0.62],
      ];
  return (
    <>
      {spots.map(([sx, sz], i) => {
        const a = seed * 6.28 + i * 2.1;
        const px = sx * Math.cos(a) - sz * Math.sin(a);
        const pz = sx * Math.sin(a) + sz * Math.cos(a);
        const s = 0.8 + ((seed * (i + 3)) % 0.4);
        return (
          <mesh
            key={i}
            geometry={geo}
            material={material}
            position={[px, h + 0.02, pz]}
            scale={[s, s, s]}
            rotation={[0, a, 0]}
          />
        );
      })}
    </>
  );
}

function Building({ cell, h }: { cell: Cell; h: number }) {
  const ref = useRef<THREE.Group>(null);
  const crystal = useRef<THREE.Mesh>(null);
  const grow = useRef(cell.building === 'base' || cell.building === 'village' ? 1 : 0);
  useFrame(({ clock }, dt) => {
    if (grow.current < 1) grow.current = Math.min(1, grow.current + dt * 2.5);
    const g = grow.current;
    const s = g < 1 ? easeOutBack(g) : 1;
    ref.current?.scale.set(s, s, s);
    if (crystal.current) {
      crystal.current.rotation.y = clock.elapsedTime * 1.4;
      crystal.current.position.y = 0.42 + Math.sin(clock.elapsedTime * 2) * 0.04;
    }
  });
  const geo = buildingGeometry(cell.building!, cell.owner);
  return (
    <group ref={ref} position={[0, h + 0.02, 0]}>
      <mesh geometry={geo} material={material} />
      {cell.building === 'mine' && (
        <mesh ref={crystal} geometry={crystalGeometry()} material={material} position={[0, 0.42, 0]} />
      )}
    </group>
  );
}

function easeOutBack(t: number) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

/** Up to five figures per cell; the exact number is shown in the label. */
function figuresFor(troops: number) {
  if (troops <= 0) return 0;
  if (troops <= 3) return troops;
  if (troops <= 7) return 4;
  return 5;
}

const SPOTS: Record<number, [number, number][]> = {
  1: [[0, 0.1]],
  2: [
    [-0.18, 0.12],
    [0.18, 0.08],
  ],
  3: [
    [-0.22, 0.15],
    [0.22, 0.15],
    [0, -0.15],
  ],
  4: [
    [-0.22, 0.2],
    [0.22, 0.2],
    [-0.22, -0.18],
    [0.22, -0.18],
  ],
  5: [
    [-0.28, 0.2],
    [0.28, 0.2],
    [0, 0.32],
    [-0.2, -0.2],
    [0.2, -0.2],
  ],
};

function Troops({ cell, h, seed }: { cell: Cell; h: number; seed: number }) {
  const group = useRef<THREE.Group>(null);
  const n = figuresFor(cell.troops);
  const geo = soldierGeometry(cell.owner);
  const ring = !!cell.building;
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    group.current?.children.forEach((c, i) => {
      c.position.y = Math.abs(Math.sin(t * 3 + i * 1.3 + seed * 10)) * (cell.owner === 'neutral' ? 0.015 : 0.035);
    });
  });
  if (n === 0) return null;
  const spots = ring
    ? Array.from({ length: n }, (_, i) => {
        const a = Math.PI * 0.55 + (i / Math.max(1, n)) * Math.PI * 0.9 - Math.PI * 0.45;
        return [Math.cos(a) * 0.6, Math.sin(a) * 0.6] as [number, number];
      })
    : SPOTS[n];
  return (
    <group position={[0, h + 0.02, 0]}>
      <group ref={group}>
        {spots.map(([sx, sz], i) => (
          <mesh
            key={i}
            geometry={geo}
            material={material}
            position={[sx, 0, sz]}
            rotation={[0, (seed - 0.5) * 0.8, 0]}
            scale={ring ? 0.85 : 1}
          />
        ))}
      </group>
    </group>
  );
}

// ---------- labels ----------

interface LabelPos {
  id: string;
  x: number;
  y: number;
  troops: number;
  owner: Cell['owner'];
  visible: boolean;
}

function Projector({ state, onLabels }: { state: MatchState; onLabels(l: LabelPos[]): void }) {
  const { camera, size } = useThree();
  const last = useRef('');
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const key = `${camera.position.x.toFixed(2)},${camera.position.y.toFixed(2)},${camera.position.z.toFixed(2)},${size.width},${size.height}`;
    const stateKey = state.order.map((id) => state.cells[id].troops + state.cells[id].owner[0]).join('');
    if (key + stateKey === last.current) return;
    last.current = key + stateKey;
    camera.updateMatrixWorld();
    const out: LabelPos[] = [];
    for (const id of state.order) {
      const c = state.cells[id];
      if (c.terrain === 'water') continue;
      if (c.owner === 'neutral' && c.troops === 0) continue;
      const { x, z } = hexToWorld(c, SIZE);
      v.set(x, HEIGHT[c.terrain] + (c.building ? 0.95 : 0.6), z).project(camera);
      out.push({
        id,
        x: ((v.x + 1) / 2) * size.width,
        y: ((1 - v.y) / 2) * size.height,
        troops: c.troops,
        owner: c.owner,
        visible: v.z < 1,
      });
    }
    onLabels(out);
  });
  return null;
}

function TroopLabel({ label }: { label: LabelPos }) {
  if (!label.visible) return null;
  const t = TEAM[label.owner];
  return (
    <View
      style={[
        styles.label,
        label.owner === 'neutral'
          ? { left: label.x - 11, top: label.y - 8, backgroundColor: 'rgba(40,34,26,0.55)', borderColor: 'transparent' }
          : { left: label.x - 13, top: label.y - 10, backgroundColor: t.dark, borderColor: t.light },
        label.owner === 'neutral' && styles.labelSmall,
      ]}
    >
      <Text style={[styles.labelText, label.owner === 'neutral' && styles.labelTextSmall]}>{label.troops}</Text>
    </View>
  );
}

// ---------- effects ----------

function Effects({ fx }: { fx: Fx[] }) {
  return (
    <>
      {fx.map((f) => (
        <Effect key={f.id} event={f.event} />
      ))}
    </>
  );
}

const worldOf = (id: string, y = 0.6) => {
  const [q, r] = id.split(',').map(Number);
  const w = hexToWorld({ q, r }, SIZE);
  return new THREE.Vector3(w.x, y, w.z);
};

function Effect({ event }: { event: GameEvent }) {
  const ref = useRef<THREE.Group>(null);
  const t0 = useRef<number | null>(null);
  const burstMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#FFF3B0',
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      }),
    [],
  );
  useEffect(() => () => burstMat.dispose(), [burstMat]);

  let from: THREE.Vector3 | null = null;
  let to: THREE.Vector3 | null = null;
  let kind: 'arrow' | 'stone' | 'fire' | 'burst' | 'none' = 'none';
  let duration = 0.6;
  if (event.type === 'shot') {
    from = worldOf(event.from, 1.2);
    to = worldOf(event.to, 0.5);
    kind = event.kind;
    duration = event.kind === 'arrow' ? 0.55 : 0.85;
  } else if (event.type === 'spell' && event.card === 'fireball' && event.cell) {
    to = worldOf(event.cell, 0.4);
    from = to.clone().add(new THREE.Vector3(1.5, 6, 1.5));
    kind = 'fire';
    duration = 0.7;
  } else if (
    (event.type === 'battle' || event.type === 'build' || event.type === 'spell') &&
    ('to' in event || 'cell' in event)
  ) {
    const id = event.type === 'battle' ? event.to : event.cell;
    if (id) {
      to = worldOf(id, 0.45);
      kind = 'burst';
      burstMat.color.set(event.type === 'battle' ? (event.captured ? '#FFE066' : '#FFFFFF') : '#8FF7FF');
    }
  }

  useFrame(({ clock }) => {
    if (!ref.current || !to) return;
    if (t0.current === null) t0.current = clock.elapsedTime;
    const p = (clock.elapsedTime - t0.current) / duration;
    if (p >= 1.4) {
      ref.current.visible = false;
      return;
    }
    if (kind === 'burst') {
      const s = 0.3 + Math.min(p, 1) * 1.1;
      ref.current.position.copy(to);
      ref.current.scale.set(s, s, s);
      burstMat.opacity = Math.max(0, 0.85 * (1 - p));
      return;
    }
    if (!from) return;
    const k = Math.min(1, p);
    const pos = from.clone().lerp(to, k);
    if (kind !== 'fire') pos.y += Math.sin(k * Math.PI) * (kind === 'stone' ? 2 : 0.8);
    ref.current.position.copy(pos);
    if (kind === 'arrow') ref.current.lookAt(to);
    if (kind === 'stone') ref.current.rotation.x += 0.2;
    ref.current.visible = p < 1;
  });

  if (kind === 'none' || !to) return null;
  return (
    <group ref={ref} visible={false}>
      {kind === 'burst' ? (
        <mesh material={burstMat} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.45, 0.8, 6]} />
        </mesh>
      ) : (
        <mesh geometry={projectileGeometry(kind)} material={material} />
      )}
    </group>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  label: {
    position: 'absolute',
    minWidth: 26,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  labelSmall: { minWidth: 22, height: 16, borderRadius: 8, borderWidth: 0 },
  labelTextSmall: { fontSize: 10, color: '#F3E9D2' },
  zoom: { position: 'absolute', right: 10, top: 10, gap: 8 },
  zoomBtn: {
    width: 38,
    height: 38,
    lineHeight: 36,
    textAlign: 'center',
    borderRadius: 19,
    overflow: 'hidden',
    backgroundColor: 'rgba(16,24,40,0.55)',
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
  },
});
