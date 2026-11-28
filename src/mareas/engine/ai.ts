/** The rival. It thinks a few times per second and plays from its hand like a person would. */
import { CARDS } from './cards';
import { LANES, canPlay, other, playCard, progress } from './match';
import { nextRandom } from './rng';
import type { CardId, CardKind, Lane, MatchState, Side } from './types';

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
  if (state.result || state.paused || !state.aiActive) return;
  brain.wait -= dt;
  if (brain.wait > 0) return;
  // Easier rivals think more slowly.
  brain.wait = Math.max(0.5, 1.6 - brain.level * 0.25) + rand(state) * 0.6;
  decide(state, brain, side);
}

function decide(state: MatchState, brain: AiBrain, side: Side) {
  const foe = other(side);
  const me = state.players[side];
  const play = (i: number, lane: Lane | null) => void playCard(state, side, i, lane);
  const handIndexOf = (filter: (id: CardId) => boolean) => handOf(state, side, filter);
  /** Position from this side's point of view (0 = own beach). */
  const mine = (d: number) => progress(side, d);
  const high = state.tide === 'high';
  const t = state.tideLeft;

  // Danger per lane: player units close to the AI island.
  const danger = LANES.map((lane) =>
    state.units.filter((u) => u.side === foe && u.lane === lane && mine(u.d) < 0.5).reduce((sum, u) => sum + u.hp, 0),
  );
  const worst = danger.indexOf(Math.max(...danger)) as Lane;

  // 1. Defend.
  if (danger[worst] > 250 && rand(state) < 0.45 + brain.level * 0.15) {
    const count = state.units.filter((u) => u.side === foe && u.lane === worst).length;
    const wave = handIndexOf((id) => id === 'ola');
    if (wave.length && count >= 2) return play(wave[0], worst);
    const kind: CardKind = high ? 'boat' : 'creature';
    const defenders = handIndexOf(ofKind(kind));
    if (defenders.length) return play(defenders[0], worst);
    const wall = handIndexOf((id) => id === 'dique' || id === 'erizos');
    if (wall.length) return play(wall[0], worst);
  }

  // 2. Drown the player's creatures with a surprise tide.
  if (!high && brain.level >= 2) {
    const exposed = state.units.filter(
      (u) => u.side === foe && u.kind === 'creature' && !u.amphibious && u.d > 0.12 && u.d < 0.88,
    );
    const surprise = handIndexOf((id) => id === 'mareaviva');
    if (surprise.length && exposed.reduce((s, u) => s + u.hp, 0) > 600) {
      return play(surprise[0], null);
    }
  }

  // 3. Rescue its own creatures caught by a rising tide with a bridge.
  if (!high && t < 5) {
    const caught = LANES.map(
      (lane) =>
        state.units.filter(
          (u) => u.side === side && u.kind === 'creature' && u.lane === lane && mine(u.d) > 0.15 && mine(u.d) < 0.88,
        ).length,
    );
    const lane = caught.indexOf(Math.max(...caught)) as Lane;
    const bridge = handIndexOf((id) => id === 'puente');
    if (caught[lane] >= 2 && bridge.length) return play(bridge[0], lane);
  }

  // 4. Attack, saving some energy first (easy rivals save more and attack less often).
  const reserve = 9 - brain.level;
  if (me.energy < reserve) return;
  let want: CardKind | null = null;
  if (!high && t > 8) want = 'creature';
  else if (!high && t < 4) want = 'boat';
  else if (high && t > 7) want = 'boat';
  else if (high && t < 4) want = 'creature';
  if (!want) return;
  const options = handIndexOf((id) => {
    const k = CARDS[id].kind;
    return k === want || (want === 'creature' && id === 'tortuga');
  });
  if (!options.length) {
    // Nothing fits the tide: play a cheap building if energy is overflowing.
    if (me.energy >= 9.5) {
      const any = handIndexOf((id) => CARDS[id].kind === 'build' && id !== 'puente');
      if (any.length) play(any[0], pick(state, LANES));
    }
    return;
  }
  // Prefer the lane where the player is weakest.
  const guard = LANES.map((lane) =>
    state.units.filter((u) => u.side === foe && u.lane === lane).reduce((s, u) => s + u.hp, 0),
  );
  const min = Math.min(...guard);
  const lanes = LANES.filter((l) => guard[l] === min);
  play(pick(state, options), pick(state, lanes));
}
