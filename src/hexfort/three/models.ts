/**
 * Procedural low-poly models, built from three.js primitives and merged into one geometry
 * per model (with vertex colours) so each figure or tower is a single draw call.
 * Everything here is generated in code, so there are no asset files or licences to track.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { BuildingKind, Owner } from '../engine';

export const TEAM: Record<Owner, { main: string; dark: string; light: string }> = {
  player: { main: '#3D8BFF', dark: '#1F4FA8', light: '#9CC6FF' },
  ai: { main: '#FF4B55', dark: '#A3202B', light: '#FFA3A8' },
  neutral: { main: '#B9A37E', dark: '#7D6A4C', light: '#E3D5B8' },
};

const C = {
  skin: '#F2C79B',
  stone: '#B8BCC6',
  stoneDark: '#868B97',
  wood: '#9A6337',
  woodDark: '#6B4224',
  wall: '#F1E4C8',
  door: '#5A3A22',
  crystal: '#5CF2FF',
  leaf: '#3FA34D',
  leafDark: '#2B7A3B',
  rock: '#9AA0A8',
  metal: '#D7DBE2',
  gold: '#FFD34D',
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
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(...pos),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)),
      new THREE.Vector3(...scale),
    );
    geo.applyMatrix4(m);
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
const ico = (r: number) => new THREE.IcosahedronGeometry(r, 0);
const dode = (r: number) => new THREE.DodecahedronGeometry(r, 0);

export const material = new THREE.MeshLambertMaterial({
  vertexColors: true,
  flatShading: true,
});

const cache = new Map<string, THREE.BufferGeometry>();
function cached(key: string, make: () => THREE.BufferGeometry) {
  let g = cache.get(key);
  if (!g) {
    g = make();
    cache.set(key, g);
  }
  return g;
}

export function soldierGeometry(owner: Owner): THREE.BufferGeometry {
  return cached(`soldier-${owner}`, () => {
    const t = TEAM[owner];
    if (owner === 'neutral') {
      return build([
        { g: cyl(0.07, 0.12, 0.26), color: t.dark, pos: [0, 0.13, 0] },
        { g: ico(0.075), color: C.skin, pos: [0, 0.32, 0] },
        { g: cone(0.095, 0.16), color: t.main, pos: [0, 0.39, -0.01] },
        {
          g: cyl(0.014, 0.014, 0.36, 4),
          color: C.woodDark,
          pos: [0.1, 0.2, 0.02],
          rot: [0, 0, 0.25],
        },
      ]);
    }
    return build([
      { g: cyl(0.07, 0.11, 0.24), color: t.main, pos: [0, 0.12, 0] },
      { g: box(0.16, 0.04, 0.12), color: C.woodDark, pos: [0, 0.17, 0] },
      { g: ico(0.075), color: C.skin, pos: [0, 0.31, 0] },
      { g: cone(0.085, 0.1), color: t.dark, pos: [0, 0.39, 0] },
      { g: cyl(0.09, 0.09, 0.02), color: t.dark, pos: [0, 0.35, 0] },
      { g: cyl(0.012, 0.012, 0.48, 4), color: C.wood, pos: [0.11, 0.24, 0] },
      { g: cone(0.025, 0.07, 4), color: C.metal, pos: [0.11, 0.5, 0] },
      { g: box(0.03, 0.15, 0.12), color: t.light, pos: [-0.1, 0.15, 0.02] },
    ]);
  });
}

function castle(t: (typeof TEAM)['player']): Part[] {
  const towers: Part[] = [];
  for (const [x, z] of [
    [-0.32, -0.32],
    [0.32, -0.32],
    [-0.32, 0.32],
    [0.32, 0.32],
  ] as const) {
    towers.push({
      g: cyl(0.12, 0.13, 0.55, 8),
      color: C.stone,
      pos: [x, 0.275, z],
    });
    towers.push({ g: cone(0.17, 0.24, 8), color: t.main, pos: [x, 0.67, z] });
  }
  return [
    { g: box(0.7, 0.32, 0.7), color: C.stoneDark, pos: [0, 0.16, 0] },
    { g: box(0.42, 0.62, 0.42), color: C.stone, pos: [0, 0.31, 0] },
    {
      g: cone(0.36, 0.34, 4),
      color: t.dark,
      pos: [0, 0.79, 0],
      rot: [0, Math.PI / 4, 0],
    },
    { g: box(0.16, 0.22, 0.03), color: C.door, pos: [0, 0.11, 0.36] },
    { g: cyl(0.012, 0.012, 0.36, 4), color: C.woodDark, pos: [0, 1.1, 0] },
    { g: box(0.2, 0.12, 0.015), color: C.gold, pos: [0.1, 1.2, 0] },
    ...towers,
  ];
}

function guard(t: (typeof TEAM)['player']): Part[] {
  const crenels: Part[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    crenels.push({
      g: box(0.09, 0.1, 0.09),
      color: C.stone,
      pos: [Math.cos(a) * 0.24, 0.85, Math.sin(a) * 0.24],
    });
  }
  return [
    { g: cyl(0.21, 0.27, 0.72, 8), color: C.stone, pos: [0, 0.36, 0] },
    { g: cyl(0.29, 0.29, 0.1, 8), color: C.stoneDark, pos: [0, 0.75, 0] },
    { g: box(0.14, 0.2, 0.02), color: t.main, pos: [0, 0.48, 0.26] },
    { g: box(0.1, 0.16, 0.03), color: C.door, pos: [0, 0.08, 0.25] },
    ...crenels,
  ];
}

function archer(t: (typeof TEAM)['player']): Part[] {
  const legs: Part[] = [];
  for (const [x, z] of [
    [-0.18, -0.18],
    [0.18, -0.18],
    [-0.18, 0.18],
    [0.18, 0.18],
  ] as const) {
    legs.push({
      g: cyl(0.03, 0.04, 0.62, 5),
      color: C.wood,
      pos: [x, 0.31, z],
    });
  }
  return [
    ...legs,
    { g: box(0.5, 0.08, 0.5), color: C.woodDark, pos: [0, 0.64, 0] },
    { g: box(0.5, 0.12, 0.03), color: C.wood, pos: [0, 0.74, 0.24] },
    { g: box(0.5, 0.12, 0.03), color: C.wood, pos: [0, 0.74, -0.24] },
    {
      g: cone(0.42, 0.34, 4),
      color: t.main,
      pos: [0, 1.05, 0],
      rot: [0, Math.PI / 4, 0],
    },
    { g: cyl(0.02, 0.02, 0.3, 4), color: C.woodDark, pos: [0, 0.83, 0] },
    {
      g: box(0.3, 0.05, 0.05),
      color: C.wood,
      pos: [0, 0.3, 0.18],
      rot: [0, 0, 0.7],
    },
  ];
}

function barracks(t: (typeof TEAM)['player']): Part[] {
  return [
    { g: box(0.62, 0.32, 0.46), color: C.wall, pos: [0, 0.16, 0] },
    {
      g: cyl(0.3, 0.3, 0.7, 3),
      color: t.main,
      pos: [0, 0.42, 0],
      rot: [0, 0, Math.PI / 2],
      scale: [1, 1, 0.95],
    },
    { g: box(0.14, 0.2, 0.02), color: C.door, pos: [0, 0.1, 0.24] },
    { g: box(0.1, 0.1, 0.02), color: C.woodDark, pos: [0.2, 0.18, 0.24] },
    { g: box(0.1, 0.1, 0.02), color: C.woodDark, pos: [-0.2, 0.18, 0.24] },
    { g: cyl(0.012, 0.012, 0.4, 4), color: C.woodDark, pos: [0.32, 0.5, 0.18] },
    { g: box(0.14, 0.09, 0.015), color: t.light, pos: [0.39, 0.64, 0.18] },
  ];
}

function mine(t: (typeof TEAM)['player']): Part[] {
  return [
    { g: dode(0.3), color: C.rock, pos: [0, 0.16, 0], scale: [1.2, 0.7, 1] },
    { g: dode(0.18), color: C.stoneDark, pos: [0.25, 0.1, 0.15] },
    { g: box(0.2, 0.2, 0.06), color: '#2A2420', pos: [0, 0.12, 0.28] },
    { g: box(0.26, 0.04, 0.08), color: C.wood, pos: [0, 0.24, 0.3] },
    { g: box(0.18, 0.08, 0.12), color: t.main, pos: [-0.28, 0.06, 0.22] },
  ];
}

export function crystalGeometry() {
  return cached('crystal', () =>
    build([
      {
        g: new THREE.OctahedronGeometry(0.12, 0),
        color: C.crystal,
        scale: [1, 1.7, 1],
      },
      {
        g: new THREE.OctahedronGeometry(0.07, 0),
        color: '#B3FBFF',
        pos: [0.12, -0.05, 0.04],
        scale: [1, 1.6, 1],
      },
    ]),
  );
}

function catapult(t: (typeof TEAM)['player']): Part[] {
  const wheels: Part[] = [];
  for (const [x, z] of [
    [-0.22, -0.2],
    [0.22, -0.2],
    [-0.22, 0.2],
    [0.22, 0.2],
  ] as const) {
    wheels.push({
      g: cyl(0.1, 0.1, 0.05, 8),
      color: C.woodDark,
      pos: [x, 0.1, z],
      rot: [Math.PI / 2, 0, 0],
    });
  }
  return [
    ...wheels,
    { g: box(0.5, 0.08, 0.36), color: C.wood, pos: [0, 0.18, 0] },
    { g: box(0.06, 0.3, 0.06), color: C.wood, pos: [0, 0.35, -0.12] },
    {
      g: box(0.06, 0.06, 0.62),
      color: C.woodDark,
      pos: [0, 0.44, 0.02],
      rot: [0.55, 0, 0],
    },
    { g: box(0.16, 0.08, 0.16), color: t.main, pos: [0, 0.6, -0.26] },
    { g: dode(0.06), color: C.rock, pos: [0, 0.68, -0.26] },
  ];
}

function village(): Part[] {
  return [
    { g: box(0.3, 0.24, 0.28), color: C.wall, pos: [-0.2, 0.12, -0.08] },
    {
      g: cyl(0.2, 0.2, 0.32, 3),
      color: '#C1583A',
      pos: [-0.2, 0.31, -0.08],
      rot: [0, 0, Math.PI / 2],
    },
    { g: box(0.26, 0.2, 0.24), color: C.wall, pos: [0.22, 0.1, 0.12] },
    {
      g: cyl(0.17, 0.17, 0.28, 3),
      color: '#D9803F',
      pos: [0.22, 0.26, 0.12],
      rot: [0, 0, Math.PI / 2],
    },
    { g: cyl(0.08, 0.09, 0.1, 8), color: C.stone, pos: [0.05, 0.05, -0.3] },
  ];
}

export function buildingGeometry(kind: BuildingKind, owner: Owner): THREE.BufferGeometry {
  return cached(`b-${kind}-${owner}`, () => {
    const t = TEAM[owner];
    switch (kind) {
      case 'base':
        return build(castle(t));
      case 'guard':
        return build(guard(t));
      case 'archer':
        return build(archer(t));
      case 'barracks':
        return build(barracks(t));
      case 'mine':
        return build(mine(t));
      case 'catapult':
        return build(catapult(t));
      case 'village':
        return build(village());
    }
  });
}

export function treeGeometry() {
  return cached('tree', () =>
    build([
      { g: cyl(0.035, 0.05, 0.16, 5), color: C.woodDark, pos: [0, 0.08, 0] },
      { g: cone(0.2, 0.3, 6), color: C.leafDark, pos: [0, 0.3, 0] },
      { g: cone(0.15, 0.26, 6), color: C.leaf, pos: [0, 0.48, 0] },
    ]),
  );
}

export function rockGeometry() {
  return cached('rock', () =>
    build([
      { g: dode(0.16), color: C.rock, pos: [0, 0.08, 0], scale: [1.2, 0.8, 1] },
      { g: dode(0.1), color: C.stoneDark, pos: [0.16, 0.04, 0.08] },
    ]),
  );
}

export function projectileGeometry(kind: 'arrow' | 'stone' | 'fire') {
  return cached(`p-${kind}`, () => {
    if (kind === 'arrow')
      return build([
        {
          g: cyl(0.012, 0.012, 0.36, 4),
          color: C.wood,
          rot: [Math.PI / 2, 0, 0],
        },
        {
          g: cone(0.03, 0.08, 4),
          color: C.metal,
          pos: [0, 0, 0.2],
          rot: [Math.PI / 2, 0, 0],
        },
      ]);
    if (kind === 'stone') return build([{ g: dode(0.1), color: C.rock }]);
    return build([
      { g: ico(0.22), color: '#FF7A1A' },
      { g: ico(0.15), color: '#FFE14D', pos: [0, 0.06, 0.04] },
    ]);
  });
}
