// Random level search. Usage: npx tsx scripts/generate.ts <profile> <count> <seed>
import { parseLevel, solve, playMoves, type LevelDefinition } from '../src/engine';

let seed = Number(process.argv[4] ?? 1) >>> 0;
// mulberry32
const rand = () => {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const ri = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));

interface Profile {
  w: [number, number];
  h: [number, number];
  wall: [number, number];
  doors: number; // number of switch/door groups
  crumble: number;
  oneway: number;
  silence: number;
  opt: [number, number];
}
const profiles: Record<string, Profile> = {
  walls: { w: [6, 7], h: [5, 7], wall: [0.15, 0.3], doors: 0, crumble: 0, oneway: 0, silence: 0, opt: [8, 14] },
  doors: { w: [6, 7], h: [6, 7], wall: [0.15, 0.28], doors: 1, crumble: 0, oneway: 0, silence: 0, opt: [8, 16] },
  doors2: { w: [7, 7], h: [7, 8], wall: [0.15, 0.25], doors: 2, crumble: 0, oneway: 0, silence: 0, opt: [10, 20] },
  crumble: { w: [6, 7], h: [6, 7], wall: [0.12, 0.25], doors: 0, crumble: 4, oneway: 0, silence: 0, opt: [8, 16] },
  oneway: { w: [6, 7], h: [6, 7], wall: [0.12, 0.25], doors: 0, crumble: 0, oneway: 3, silence: 0, opt: [8, 16] },
  silence: { w: [6, 7], h: [6, 7], wall: [0.12, 0.25], doors: 0, crumble: 0, oneway: 0, silence: 1, opt: [8, 16] },
  mix: { w: [7, 7], h: [7, 9], wall: [0.12, 0.22], doors: 1, crumble: 3, oneway: 2, silence: 1, opt: [12, 24] },
  mix2: { w: [7, 7], h: [8, 9], wall: [0.12, 0.22], doors: 2, crumble: 2, oneway: 2, silence: 0, opt: [14, 26] },
};

const prof = profiles[process.argv[2]];
const wanted = Number(process.argv[3] ?? 5);

function genMap(p: Profile): string[] {
  const W = ri(...p.w);
  const H = ri(...p.h);
  const dens = p.wall[0] + rand() * (p.wall[1] - p.wall[0]);
  const g: string[][] = [];
  for (let y = 0; y < H; y++) {
    g.push([]);
    for (let x = 0; x < W; x++) g[y].push(y === 0 || x === 0 || y === H - 1 || x === W - 1 ? '#' : rand() < dens ? '#' : '.');
  }
  const free = () => {
    for (let i = 0; i < 200; i++) {
      const x = ri(1, W - 2), y = ri(1, H - 2);
      if (g[y][x] === '.') return [x, y];
    }
    return null;
  };
  const put = (c: string) => { const f = free(); if (f) g[f[1]][f[0]] = c; };
  put('S'); put('E');
  for (let i = 0; i < p.doors; i++) { put('abcd'[i]); put(rand() < 0.75 ? 'ABCD'[i] : '1234'[i]); if (rand() < 0.4) put('ABCD'[i]); }
  for (let i = 0; i < ri(0, p.crumble); i++) put('%');
  for (let i = 0; i < ri(0, p.oneway); i++) put('^>v<'[ri(0, 3)]);
  for (let i = 0; i < p.silence; i++) put('*');
  return g.map((r) => r.join(''));
}

function strip(map: string[], from: RegExp, to: string) { return map.map((r) => r.replace(from, to)); }

const found: { score: number; def: LevelDefinition; info: string }[] = [];
let tries = 0;
while (found.length < wanted && tries < 200000) {
  tries++;
  const map = genMap(prof);
  if (!map.join('').includes('S') || !map.join('').includes('E')) continue;
  const def: LevelDefinition = { id: `g${tries}`, name: '', map };
  const lvl = parseLevel(def);
  const r = solve(lvl, { maxStates: 300000 });
  if (!r.solution) continue;
  const opt = r.solution.length;
  if (opt < prof.opt[0] || opt > prof.opt[1]) continue;
  const plain = solve(parseLevel({ ...def, echoDelay: 999 }));
  const plainLen = plain.solution?.length ?? 99;
  // naive path must fail when echoes are on
  let naiveWins = false;
  try { naiveWins = playMoves(lvl, plain.solution!).status === 'won'; } catch { naiveWins = false; }
  if (naiveWins) continue;
  // every feature must matter
  let ok = true;
  const checks: [RegExp, string][] = [];
  if (prof.doors) checks.push([/[A-D1-4]/g, '.'], [/[a-d]/g, '.']);
  if (prof.crumble) checks.push([/%/g, '.']);
  if (prof.oneway) checks.push([/[\^>v<]/g, '.']);
  if (prof.silence) checks.push([/\*/g, '.']);
  for (const [re, to] of checks) {
    if (!map.join('').match(re)) { ok = false; break; }
    const alt = solve(parseLevel({ ...def, map: strip(map, re, to) }), { maxStates: 300000 });
    if (alt.solution && alt.solution.length === opt) { ok = false; break; }
  }
  if (!ok) continue;
  const score = (opt - plainLen) * 3 + Math.log2(r.explored) + opt * 0.3;
  console.log(JSON.stringify(map), `opt=${opt} plain=${plainLen} states=${r.explored}`, score.toFixed(1));
  found.push({ score, def, info: `opt=${opt} plain=${plainLen} states=${r.explored}` });
}
found.sort((a, b) => b.score - a.score);

console.error(`tries=${tries}`);
