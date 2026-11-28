/** The rival. It thinks a few times per second and plays from its hand like a person would. */
import { CARDS } from './cards';
import { HOME, dist, findPath } from './map';
import { canPlay, other, playCard, walkable } from './match';
import { nextRandom } from './rng';
import type { CardId, CardKind, MatchState, Side } from './types';

export interface AiBrain {
  /** Seconds until the next decision. */
  wait: number;
  /** 1 = easiest. */
  level: number;
}

export const createBrain = (level: number): AiBrain => ({ wait: 2.5, level });

function rand(state: MatchState) {
  const [r, s] = nextRandom(state.seed);
  state.seed = s;
  return r;
}

function pick<T>(state: MatchState, items: T[]): T {
  return items[Math.floor(rand(state) * items.length)];
}

function handOf(state: MatchState, side: Side, filter: (id: CardId) => boolean): number[] {
  const p = state.players[side];
  return p.hand.map((id, i) => (filter(id) && canPlay(state, side, i) === null ? i : -1)).filter((i) => i >= 0);
}

const ofKind = (k: CardKind) => (id: CardId) => CARDS[id].kind === k;

export function aiThink(state: MatchState, brain: AiBrain, dt: number, side: Side = 'ai') {
  if (state.result || state.paused || (!state.aiActive && side === 'ai')) return;
  brain.wait -= dt;
  if (brain.wait > 0) return;
  // Easier rivals think more slowly.
  brain.wait = Math.max(0.5, 1.6 - brain.level * 0.25) + rand(state) * 0.6;
  decide(state, brain, side);
}

function decide(state: MatchState, brain: AiBrain, side: Side) {
  const foe = other(side);
  const me = state.players[side];
  const map = state.map;
  const high = state.tide === 'high';
  const t = state.tideLeft;
  const play = (i: number, island: number | null) => void playCard(state, side, i, island);
  const hand = (filter: (id: CardId) => boolean) => handOf(state, side, filter);
  const homeId = HOME[side];
  const home = map.islands[homeId];
  /** Can a creature of ours walk there right now? */
  const reachable = (island: number) => !!findPath(map, homeId, island, (b) => walkable(state, side, b));
  /** The right unit card for this tide, sent to `island`. */
  const unitFor = (island: number): number[] => {
    if (high) return hand(ofKind('boat'));
    const walkers = hand((id) => CARDS[id].kind === 'creature');
    return reachable(island) ? walkers : hand((id) => id === 'tortuga');
  };

  // 1. Defend home and owned islands.
  const guarded = map.islands.filter((i) => i.id === homeId || state.islands[i.id].owner === side);
  let threat = -1;
  let threatHp = 0;
  for (const isl of guarded) {
    const reach = isl.r + (isl.id === homeId ? 3 : 1.5);
    const hp = state.units
      .filter((u) => u.side === foe && dist(u.x, u.z, isl.x, isl.z) <= reach)
      .reduce((s, u) => s + u.hp, 0);
    if (hp > threatHp) {
      threatHp = hp;
      threat = isl.id;
    }
  }
  if (threat >= 0 && threatHp > 250 && rand(state) < 0.45 + brain.level * 0.15) {
    const isl = map.islands[threat];
    const near = state.units.filter((u) => u.side === foe && dist(u.x, u.z, isl.x, isl.z) <= isl.r + 2.5).length;
    const wave = hand((id) => id === 'ola');
    if (wave.length && near >= 2) return play(wave[0], threat);
    const defenders = unitFor(threat);
    if (defenders.length) return play(defenders[0], threat);
    const wall = hand((id) => id === 'dique' || id === 'erizos');
    if (wall.length) return play(wall[0], threat);
  }

  // 2. Drown the rival's creatures with a surprise tide.
  if (!high && brain.level >= 2) {
    const exposed = state.units.filter(
      (u) => u.side === foe && u.kind === 'creature' && !u.amphibious && u.next !== null,
    );
    const surprise = hand((id) => id === 'mareaviva');
    if (surprise.length && exposed.reduce((s, u) => s + u.hp, 0) > 600) return play(surprise[0], null);
  }

  // 3. Save its own creatures caught by a rising tide with a bridge.
  if (!high && t < 5) {
    const caught = state.units.filter((u) => u.side === side && u.kind === 'creature' && u.next !== null);
    const bridge = hand((id) => id === 'puente');
    if (caught.length >= 2 && bridge.length) return play(bridge[0], caught[0].next);
  }

  // 4. Expand or attack, saving some energy first (easy rivals save more).
  if (me.energy < 9 - brain.level) return;
  let want: CardKind | null = null;
  if (!high && t > 7) want = 'creature';
  else if (!high && t < 4) want = 'boat';
  else if (high && t > 6) want = 'boat';
  else if (high && t < 4) want = 'creature';
  if (!want) return;

  const owned = map.islands.filter((i) => i.kind !== 'home' && state.islands[i.id].owner === side).length;
  const foeHome = HOME[foe];
  // Islands worth taking, nearest first (Perla islands a bit more attractive).
  const goals = map.islands
    .filter((i) => i.kind !== 'home' && state.islands[i.id].owner !== side)
    .sort(
      (a, b) =>
        dist(a.x, a.z, home.x, home.z) -
        (a.kind === 'energy' ? 1 : 0) -
        (dist(b.x, b.z, home.x, home.z) - (b.kind === 'energy' ? 1 : 0)),
    );
  const attack = !goals.length || owned >= 2 || rand(state) < 0.3;
  let goal = attack ? foeHome : goals[0].id;
  if (want === 'creature' && !high && !reachable(goal)) {
    const alt = [foeHome, ...goals.map((g) => g.id)].find(reachable);
    if (alt === undefined) want = null;
    else goal = alt;
  }
  if (!want) return;
  const options = hand((id) => CARDS[id].kind === want || (want === 'creature' && id === 'tortuga'));
  if (!options.length) {
    // Nothing fits the tide: fortify an island if energy is overflowing.
    if (me.energy >= 9.5) {
      const any = hand((id) => id === 'dique' || id === 'erizos');
      const mine = map.islands.filter((i) => state.islands[i.id].owner === side);
      if (any.length) play(any[0], pick(state, mine).id);
    }
    return;
  }
  play(pick(state, options), goal);
}
