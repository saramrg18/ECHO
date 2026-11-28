/**
 * The archipelago: your home island, the rival's, and small islands in between joined by sandbars.
 * Each low tide uncovers a different set of sandbars (always fair: the set is the same seen from
 * either side, and there is always a way across).
 */
import { nextRandom } from './rng';
import type { Bar, Island, MapDef, MatchState, Side } from './types';

const islands: Island[] = [
  { id: 0, name: 'Tu isla', kind: 'home', x: 0, z: 10.2, r: 3.2, home: 'player' },
  { id: 1, name: 'Isla rival', kind: 'home', x: 0, z: -10.2, r: 3.2, home: 'ai' },
  { id: 2, name: 'Isla Perla', kind: 'energy', x: -4.3, z: 4.4, r: 1.35 },
  { id: 3, name: 'Isla Roca', kind: 'fort', x: 4.3, z: 4.4, r: 1.35 },
  { id: 4, name: 'Isla Grande', kind: 'energy', x: 0, z: 0, r: 1.7 },
  { id: 5, name: 'Isla Roca', kind: 'fort', x: -4.3, z: -4.4, r: 1.35 },
  { id: 6, name: 'Isla Perla', kind: 'energy', x: 4.3, z: -4.4, r: 1.35 },
];

const bars: Bar[] = [
  { id: 0, a: 0, b: 2 },
  { id: 1, a: 1, b: 6 },
  { id: 2, a: 0, b: 3 },
  { id: 3, a: 1, b: 5 },
  { id: 4, a: 2, b: 4 },
  { id: 5, a: 6, b: 4 },
  { id: 6, a: 3, b: 4 },
  { id: 7, a: 5, b: 4 },
  { id: 8, a: 2, b: 5 },
  { id: 9, a: 6, b: 3 },
];

/** Bars come in mirror pairs (same bar seen from the other side). */
const PAIRS: number[][] = [
  [0, 1],
  [2, 3],
  [4, 5],
  [6, 7],
  [8, 9],
];

export const ARCHIPELAGO: MapDef = { islands, bars };

export const HOME: Record<Side, number> = { player: 0, ai: 1 };

export const dist = (ax: number, az: number, bx: number, bz: number) => Math.hypot(ax - bx, az - bz);

export function barBetween(map: MapDef, a: number, b: number): Bar | undefined {
  return map.bars.find((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a));
}

/** Shortest path (by length) from island `from` to `to`, using only `allowed` bars. */
export function findPath(map: MapDef, from: number, to: number, allowed: (bar: Bar) => boolean): number[] | null {
  if (from === to) return [from];
  const n = map.islands.length;
  const best = new Array(n).fill(Infinity);
  const prev = new Array<number>(n).fill(-1);
  const done = new Array(n).fill(false);
  best[from] = 0;
  for (;;) {
    let u = -1;
    for (let i = 0; i < n; i++) if (!done[i] && best[i] < Infinity && (u < 0 || best[i] < best[u])) u = i;
    if (u < 0) return null;
    if (u === to) break;
    done[u] = true;
    for (const bar of map.bars) {
      if (!allowed(bar)) continue;
      const v = bar.a === u ? bar.b : bar.b === u ? bar.a : -1;
      if (v < 0 || done[v]) continue;
      const iu = map.islands[u];
      const iv = map.islands[v];
      const w = best[u] + dist(iu.x, iu.z, iv.x, iv.z);
      if (w < best[v]) {
        best[v] = w;
        prev[v] = u;
      }
    }
  }
  const path = [to];
  while (path[0] !== from) path.unshift(prev[path[0]]);
  return path;
}

/** Picks the sandbars for the next low tide: 3 of the 5 mirror pairs, always linking both homes. */
export function rollBars(state: MatchState): number[] {
  for (let attempt = 0; attempt < 50; attempt++) {
    const pool = [...PAIRS];
    const chosen: number[] = [];
    for (let k = 0; k < 3; k++) {
      const [r, s] = nextRandom(state.seed);
      state.seed = s;
      chosen.push(...pool.splice(Math.floor(r * pool.length), 1)[0]);
    }
    if (chosen.join() === state.openBars.join()) continue;
    if (findPath(state.map, HOME.player, HOME.ai, (b) => chosen.includes(b.id))) return chosen.sort((a, b) => a - b);
  }
  return [0, 1, 4, 5, 6, 7];
}

/** Where along a bar a walker is, and whether that point is dry land (on an island). */
export function barPoint(map: MapDef, from: number, to: number, t: number) {
  const a = map.islands[from];
  const b = map.islands[to];
  const x = a.x + (b.x - a.x) * t;
  const z = a.z + (b.z - a.z) * t;
  const len = dist(a.x, a.z, b.x, b.z);
  const onLand = t * len <= a.r * 0.9 || (1 - t) * len <= b.r * 0.9;
  return { x, z, len, onLand };
}

/** Island under a point, if any. */
export function islandAt(map: MapDef, x: number, z: number, slack = 0): Island | null {
  for (const i of map.islands) if (dist(i.x, i.z, x, z) <= i.r + slack) return i;
  return null;
}
