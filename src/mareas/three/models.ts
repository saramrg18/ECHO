/**
 * Procedural low-poly models for MAREAS: sea creatures, boats, lighthouses and buildings.
 * Each model is built from three.js primitives and merged into one geometry with vertex colours,
 * so it is a single draw call and there are no asset files.
 * Models face +z; the scene turns the player's ones around.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { CardId, Side } from '../engine';

export const TEAM: Record<Side, { main: string; dark: string; light: string; glow: string }> = {
  player: { main: '#FF9F1C', dark: '#C46A00', light: '#FFD08A', glow: '#FFE7A3' },
  ai: { main: '#9B6BFF', dark: '#5B34C2', light: '#CDB6FF', glow: '#E4D8FF' },
};

const C = {
  white: '#FFFFFF',
  black: '#1B1B26',
  wood: '#A86B3C',
  woodDark: '#6E4426',
  stone: '#B7B2A6',
  stoneDark: '#8A8578',
  skin: '#7DBA5A',
  skinDark: '#4E8A3A',
  walrus: '#9C6B4E',
  tusk: '#FFF6E0',
  sail: '#FFF8EC',
  metal: '#4A4E5A',
  leaf: '#3FA34D',
  trunk: '#9A6A3E',
  coral: '#FF6F91',
  coral2: '#FFB347',
  glass: '#FFF7C2',
  red: '#E8484F',
};

type V3 = [number, number, number];
interface Part {
  g: THREE.BufferGeometry;
  color: string;
  pos?: V3;
  rot?: V3;
  scale?: V3;
}

function build(parts: Part[]): THREE.BufferGeometry {
  const geos = parts.map(({ g, color, pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1] }) => {
    const geo = g.index ? g.toNonIndexed() : g.clone();
    geo.deleteAttribute('uv');
    if (geo.getAttribute('normal')) geo.deleteAttribute('normal');
    geo.applyMatrix4(
      new THREE.Matrix4().compose(
        new THREE.Vector3(...pos),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)),
        new THREE.Vector3(...scale),
      ),
    );
    const col = new THREE.Color(color);
    const n = geo.getAttribute('position').count;
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.toArray(colors, i * 3);
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geo;
  });
  const merged = mergeGeometries(geos, false)!;
  merged.computeVertexNormals();
  return merged;
}

const cyl = (rt: number, rb: number, h: number, seg = 6) => new THREE.CylinderGeometry(rt, rb, h, seg);
const cone = (r: number, h: number, seg = 6) => new THREE.ConeGeometry(r, h, seg);
const box = (x: number, y: number, z: number) => new THREE.BoxGeometry(x, y, z);
const ico = (r: number, detail = 0) => new THREE.IcosahedronGeometry(r, detail);
const dome = (r: number) => new THREE.SphereGeometry(r, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);

export const material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });

const cache = new Map<string, THREE.BufferGeometry>();
function cached(key: string, make: () => THREE.BufferGeometry) {
  let g = cache.get(key);
  if (!g) {
    g = make();
    cache.set(key, g);
  }
  return g;
}

const eyes = (y: number, z: number, gap: number, r = 0.045): Part[] => [
  { g: ico(r), color: C.white, pos: [-gap, y, z] },
  { g: ico(r), color: C.white, pos: [gap, y, z] },
  { g: ico(r * 0.55), color: C.black, pos: [-gap, y, z + r * 0.7] },
  { g: ico(r * 0.55), color: C.black, pos: [gap, y, z + r * 0.7] },
];

function crab(side: Side): Part[] {
  const t = TEAM[side];
  const legs: Part[] = [];
  for (const sx of [-1, 1])
    for (let i = 0; i < 3; i++)
      legs.push({
        g: box(0.2, 0.03, 0.03),
        color: t.dark,
        pos: [sx * 0.2, 0.06, -0.06 + i * 0.07],
        rot: [0, 0, sx * -0.6],
      });
  return [
    { g: ico(0.17, 1), color: t.main, pos: [0, 0.14, 0], scale: [1.25, 0.6, 0.95] },
    { g: ico(0.08), color: t.main, pos: [-0.2, 0.14, 0.17], scale: [1, 0.7, 1.3] },
    { g: ico(0.08), color: t.main, pos: [0.2, 0.14, 0.17], scale: [1, 0.7, 1.3] },
    { g: box(0.03, 0.1, 0.03), color: t.dark, pos: [-0.06, 0.26, 0.08] },
    { g: box(0.03, 0.1, 0.03), color: t.dark, pos: [0.06, 0.26, 0.08] },
    ...eyes(0.32, 0.08, 0.06, 0.04),
    ...legs,
  ];
}

function turtle(side: Side): Part[] {
  const t = TEAM[side];
  const legs: Part[] = [];
  for (const [x, z] of [
    [-0.22, 0.16],
    [0.22, 0.16],
    [-0.22, -0.16],
    [0.22, -0.16],
  ] as const)
    legs.push({ g: ico(0.08), color: C.skin, pos: [x, 0.06, z], scale: [1.2, 0.6, 1] });
  return [
    { g: dome(0.32), color: t.main, pos: [0, 0.08, 0], scale: [1, 0.85, 1.1] },
    { g: cyl(0.33, 0.33, 0.06, 8), color: t.dark, pos: [0, 0.08, 0], scale: [1, 1, 1.1] },
    { g: ico(0.09), color: t.light, pos: [0, 0.34, 0], scale: [1.3, 0.4, 1.3] },
    { g: ico(0.11, 1), color: C.skin, pos: [0, 0.16, 0.38] },
    ...eyes(0.22, 0.45, 0.05, 0.035),
    ...legs,
  ];
}

function walrus(side: Side): Part[] {
  const t = TEAM[side];
  return [
    { g: ico(0.3, 1), color: C.walrus, pos: [0, 0.27, 0], scale: [1, 0.9, 1.25] },
    { g: ico(0.2, 1), color: C.walrus, pos: [0, 0.48, 0.24] },
    { g: ico(0.1), color: '#C9967A', pos: [0, 0.42, 0.4], scale: [1.4, 0.8, 0.8] },
    { g: cone(0.025, 0.2, 4), color: C.tusk, pos: [-0.05, 0.3, 0.42], rot: [Math.PI, 0, 0] },
    { g: cone(0.025, 0.2, 4), color: C.tusk, pos: [0.05, 0.3, 0.42], rot: [Math.PI, 0, 0] },
    ...eyes(0.56, 0.38, 0.07, 0.035),
    // A captain's hat in team colour.
    { g: cyl(0.17, 0.2, 0.06, 8), color: t.dark, pos: [0, 0.66, 0.2] },
    { g: cyl(0.12, 0.15, 0.12, 8), color: t.main, pos: [0, 0.74, 0.2] },
    { g: ico(0.09), color: C.walrus, pos: [-0.28, 0.1, 0.15], scale: [1.4, 0.4, 1] },
    { g: ico(0.09), color: C.walrus, pos: [0.28, 0.1, 0.15], scale: [1.4, 0.4, 1] },
  ];
}

function puffer(side: Side): Part[] {
  const t = TEAM[side];
  const spikes: Part[] = [];
  const g = ico(1);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i += 3) {
    const v = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i)).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v);
    const e = new THREE.Euler().setFromQuaternion(q);
    spikes.push({
      g: cone(0.03, 0.12, 4),
      color: t.light,
      pos: [v.x * 0.24, 0.3 + v.y * 0.24, v.z * 0.24],
      rot: [e.x, e.y, e.z],
    });
  }
  return [
    { g: ico(0.22, 1), color: t.main, pos: [0, 0.3, 0] },
    { g: cone(0.1, 0.14, 4), color: t.dark, pos: [0, 0.3, -0.26], rot: [-Math.PI / 2, 0, 0] },
    ...eyes(0.36, 0.19, 0.08, 0.05),
    ...spikes,
  ];
}

function sailor(side: Side, pos: V3): Part[] {
  const t = TEAM[side];
  return [
    { g: cyl(0.06, 0.08, 0.16), color: t.main, pos: [pos[0], pos[1] + 0.08, pos[2]] },
    { g: ico(0.07), color: '#F2C79B', pos: [pos[0], pos[1] + 0.22, pos[2]] },
    { g: cyl(0.075, 0.075, 0.04, 8), color: t.dark, pos: [pos[0], pos[1] + 0.29, pos[2]] },
  ];
}

function hull(len: number, w: number, h: number, color: string, dark: string): Part[] {
  return [
    { g: box(w, h, len), color, pos: [0, h / 2, 0] },
    {
      g: cone(w * 0.72, len * 0.35, 4),
      color,
      pos: [0, h / 2, len / 2 + len * 0.17],
      rot: [Math.PI / 2, Math.PI / 4, 0],
      scale: [1, 1, (h / w) * 1.4],
    },
    { g: box(w * 1.04, 0.04, len * 1.02), color: dark, pos: [0, h, 0] },
  ];
}

function rowboat(side: Side): Part[] {
  const t = TEAM[side];
  return [
    ...hull(0.6, 0.32, 0.14, C.wood, C.woodDark),
    { g: box(0.7, 0.02, 0.04), color: C.woodDark, pos: [0, 0.14, 0], rot: [0, 0.3, 0.2] },
    ...sailor(side, [0, 0.12, -0.05]),
    { g: cyl(0.012, 0.012, 0.4, 4), color: C.woodDark, pos: [0, 0.3, -0.25] },
    { g: box(0.015, 0.1, 0.16), color: t.main, pos: [0, 0.44, -0.18] },
  ];
}

function sloop(side: Side): Part[] {
  const t = TEAM[side];
  return [
    ...hull(0.85, 0.4, 0.18, '#C9874F', C.woodDark),
    { g: cyl(0.02, 0.02, 0.9, 4), color: C.woodDark, pos: [0, 0.6, 0] },
    { g: cone(0.34, 0.72, 3), color: t.main, pos: [0, 0.6, -0.08], scale: [0.08, 1, 1] },
    { g: cone(0.22, 0.5, 3), color: C.sail, pos: [0, 0.5, 0.25], scale: [0.06, 1, 0.8] },
    { g: cyl(0.04, 0.04, 0.22, 6), color: C.metal, pos: [0, 0.24, 0.35], rot: [Math.PI / 2, 0, 0] },
    ...sailor(side, [0, 0.18, -0.25]),
  ];
}

function galleon(side: Side): Part[] {
  const t = TEAM[side];
  const cannons: Part[] = [];
  for (const sx of [-1, 1])
    for (let i = 0; i < 3; i++)
      cannons.push({
        g: cyl(0.035, 0.035, 0.1, 6),
        color: C.metal,
        pos: [sx * 0.31, 0.2, -0.25 + i * 0.25],
        rot: [0, 0, Math.PI / 2],
      });
  return [
    ...hull(1.2, 0.56, 0.26, '#8E5A33', '#5A361E'),
    { g: box(0.56, 0.2, 0.32), color: '#8E5A33', pos: [0, 0.36, -0.44] },
    { g: cyl(0.03, 0.03, 1.2, 4), color: C.woodDark, pos: [0, 0.86, 0.12] },
    { g: cyl(0.025, 0.025, 0.9, 4), color: C.woodDark, pos: [0, 0.72, -0.3] },
    { g: box(0.52, 0.34, 0.03), color: t.main, pos: [0, 0.92, 0.12], scale: [1, 1, 1] },
    { g: box(0.42, 0.26, 0.03), color: C.sail, pos: [0, 0.6, 0.12] },
    { g: box(0.4, 0.26, 0.03), color: t.main, pos: [0, 0.78, -0.3] },
    { g: box(0.03, 0.1, 0.18), color: t.light, pos: [0, 1.5, 0.18] },
    ...cannons,
  ];
}

const UNIT_BUILDERS: Partial<Record<CardId, (s: Side) => Part[]>> = {
  cangrejos: crab,
  tortuga: turtle,
  morsa: walrus,
  pezglobo: puffer,
  bote: rowboat,
  balandro: sloop,
  galeon: galleon,
};

export function unitGeometry(card: CardId, side: Side) {
  return cached(`${card}-${side}`, () => build((UNIT_BUILDERS[card] ?? crab)(side)));
}

export function lighthouseGeometry(side: Side) {
  return cached(`lighthouse-${side}`, () => {
    const t = TEAM[side];
    const parts: Part[] = [
      { g: cyl(0.95, 1.1, 0.4, 8), color: C.stoneDark, pos: [0, 0.2, 0] },
      { g: box(0.5, 0.6, 0.5), color: C.white, pos: [0.9, 0.3, 0.3] },
      { g: cone(0.42, 0.3, 4), color: t.dark, pos: [0.9, 0.75, 0.3], rot: [0, Math.PI / 4, 0] },
    ];
    // Striped tower.
    const stripes = 5;
    for (let i = 0; i < stripes; i++) {
      const y0 = 0.4 + i * 0.5;
      const r0 = 0.62 - i * 0.06;
      parts.push({ g: cyl(r0 - 0.06, r0, 0.5, 10), color: i % 2 ? t.main : C.white, pos: [0, y0 + 0.25, 0] });
    }
    const top = 0.4 + stripes * 0.5;
    parts.push(
      { g: cyl(0.55, 0.45, 0.1, 10), color: C.metal, pos: [0, top + 0.05, 0] },
      { g: cyl(0.3, 0.3, 0.45, 8), color: C.glass, pos: [0, top + 0.32, 0] },
      { g: cone(0.42, 0.4, 10), color: t.dark, pos: [0, top + 0.75, 0] },
      { g: ico(0.06), color: t.light, pos: [0, top + 1, 0] },
      { g: box(0.18, 0.3, 0.05), color: C.woodDark, pos: [0, 0.55, 0.6] },
    );
    return build(parts);
  });
}
export const LIGHTHOUSE_LAMP_Y = 0.4 + 5 * 0.5 + 0.32;

export function palmGeometry() {
  return cached('palm', () => {
    const parts: Part[] = [];
    for (let i = 0; i < 5; i++)
      parts.push({
        g: cyl(0.07, 0.08, 0.3, 5),
        color: i % 2 ? C.trunk : '#B07E4E',
        pos: [i * 0.03, 0.15 + i * 0.28, 0],
        rot: [0, 0, -0.08],
      });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      parts.push({
        g: box(0.7, 0.03, 0.18),
        color: i % 2 ? C.leaf : '#57B85A',
        pos: [0.15 + Math.cos(a) * 0.32, 1.45, Math.sin(a) * 0.32],
        rot: [0, -a, -0.35],
      });
    }
    parts.push(
      { g: ico(0.07), color: '#6B4A2A', pos: [0.18, 1.38, 0.06] },
      { g: ico(0.07), color: '#6B4A2A', pos: [0.1, 1.38, -0.08] },
    );
    return build(parts);
  });
}

export function rockGeometry() {
  return cached('rock', () =>
    build([
      { g: new THREE.DodecahedronGeometry(0.35, 0), color: C.stone, scale: [1.3, 0.7, 1] },
      { g: new THREE.DodecahedronGeometry(0.2, 0), color: C.stoneDark, pos: [0.35, -0.05, 0.1] },
    ]),
  );
}

export function coralGeometry() {
  return cached('coral', () => {
    const parts: Part[] = [];
    for (let i = 0; i < 9; i++) {
      const x = ((i * 37) % 10) / 10 - 0.5;
      const z = ((i * 53) % 10) / 10 - 0.5;
      const h = 0.25 + ((i * 17) % 5) * 0.06;
      parts.push({
        g: cyl(0.03, 0.06, h, 5),
        color: i % 2 ? C.coral : C.coral2,
        pos: [x * 1.1, h / 2, z * 2.6],
        rot: [0.3 * x, 0, 0.4 * z],
      });
      parts.push({ g: ico(0.06), color: i % 3 ? C.coral : '#FF8FB1', pos: [x * 1.1, h, z * 2.6] });
    }
    return build(parts);
  });
}

export function bridgeGeometry(side: Side, length: number) {
  return cached(`bridge-${side}-${length}`, () => {
    const t = TEAM[side];
    const parts: Part[] = [];
    const n = Math.round(length / 0.35);
    for (let i = 0; i < n; i++) {
      parts.push({
        g: box(1.2, 0.06, 0.3),
        color: i % 2 ? C.wood : '#B87A47',
        pos: [0, 0, -length / 2 + (i + 0.5) * (length / n)],
      });
    }
    for (let i = 0; i <= 6; i++) {
      const z = -length / 2 + (i * length) / 6;
      parts.push({ g: cyl(0.05, 0.05, 0.9, 5), color: C.woodDark, pos: [-0.6, -0.2, z] });
      parts.push({ g: cyl(0.05, 0.05, 0.9, 5), color: C.woodDark, pos: [0.6, -0.2, z] });
    }
    parts.push({ g: box(0.06, 0.06, length), color: t.main, pos: [-0.6, 0.25, 0] });
    parts.push({ g: box(0.06, 0.06, length), color: t.main, pos: [0.6, 0.25, 0] });
    return build(parts);
  });
}

export function wallGeometry(side: Side) {
  return cached(`wall-${side}`, () => {
    const t = TEAM[side];
    const parts: Part[] = [];
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 2; j++)
        parts.push({
          g: box(0.34, 0.24, 0.36),
          color: (i + j) % 2 ? C.stone : C.stoneDark,
          pos: [-0.54 + i * 0.36 + (j ? 0.12 : 0), 0.12 + j * 0.25, 0],
        });
    parts.push({ g: box(1.4, 0.06, 0.4), color: t.main, pos: [0, 0.52, 0] });
    parts.push({ g: cyl(0.012, 0.012, 0.4, 4), color: C.woodDark, pos: [0.6, 0.75, 0] });
    parts.push({ g: box(0.015, 0.12, 0.2), color: t.main, pos: [0.6, 0.9, 0.1] });
    return build(parts);
  });
}

export function trapGeometry(side: Side) {
  return cached(`trap-${side}`, () => {
    const t = TEAM[side];
    const parts: Part[] = [];
    for (let i = 0; i < 6; i++) {
      const x = -0.5 + (i % 3) * 0.5;
      const z = i < 3 ? -0.18 : 0.18;
      parts.push({ g: ico(0.1), color: '#2B2238', pos: [x, 0.08, z] });
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        parts.push({
          g: cone(0.025, 0.14, 4),
          color: k % 2 ? '#3E3354' : t.dark,
          pos: [x + Math.cos(a) * 0.09, 0.12, z + Math.sin(a) * 0.09],
          rot: [Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9],
        });
      }
    }
    return build(parts);
  });
}
