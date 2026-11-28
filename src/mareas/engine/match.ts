/**
 * The match simulation. It is plain, mutable TypeScript (no React) so it can run every frame
 * on the phone and be tested headless.
 *
 * Rules in one place:
 * - The tide changes every TIDE_PERIOD seconds. Low tide uncovers the three sandbars, high tide covers them.
 * - Creatures walk on sand. If the tide rises while one is on a sandbar, it drowns
 *   (unless it swims, or its own bridge is on that lane). Played at high tide, it waits on its beach.
 * - Boats sail on water. If the tide falls while one is out on a lane, it is stranded:
 *   it can't move and slowly breaks. Played at low tide, it waits at its dock.
 * - Units that reach the rival island hit its lighthouse. Lighthouses shoot back.
 * - The first lighthouse to go dark loses. At the end of time, more light left wins.
 */
import { BRIDGE_TTL, CARDS, HAND_SIZE, TRAP, WALL, WAVE, levelBoost } from './cards';
import { shuffle } from './rng';
import type { CardId, Lane, MatchConfig, MatchState, Side, SidePlayer, Structure, Unit } from './types';

export const TIDE_PERIOD = 20;
export const MATCH_DURATION = 180;
export const MAX_ENERGY = 10;
export const ENERGY_PER_SEC = 0.5;
export const LIGHTHOUSE_HP = 1500;
export const LIGHTHOUSE = { dmg: 60, interval: 1, reach: 0.3 };
/** In the last minute energy comes twice as fast. */
export const RUSH_TIME = 60;
/** Beach zone at each end of a lane: dry at any tide. */
export const BEACH = 0.06;
/** Units stop here, in front of the rival lighthouse. */
export const FRONT = 0.95;
export const DROWN_RATE = 0.55;
export const STRAND_RATE = 0.14;
export const CORAL = { from: 0.4, to: 0.6, dps: 45 };
/** How fast the water level animates between tides (per second). */
const WATER_SPEED = 1.6;

export const LANES: Lane[] = [0, 1, 2];
export const other = (s: Side): Side => (s === 'player' ? 'ai' : 'player');
/** Progress along the lane from this side's own beach (0) to the rival's (1). */
export const progress = (side: Side, d: number) => (side === 'player' ? d : 1 - d);
const fromProgress = (side: Side, p: number) => (side === 'player' ? p : 1 - p);

function makeSide(deck: CardId[], levels: SidePlayer['levels'], seed: number, fixed: boolean): [SidePlayer, number] {
  const [order, s] = fixed ? [[...deck], seed] : shuffle(deck, seed);
  return [
    {
      energy: 5,
      hand: order.slice(0, HAND_SIZE),
      queue: order.slice(HAND_SIZE),
      levels,
      lighthouse: LIGHTHOUSE_HP,
      lighthouseMax: LIGHTHOUSE_HP,
      beamCooldown: 0,
      energyRate: 1,
    },
    s,
  ];
}

export function createMatch(cfg: MatchConfig): MatchState {
  let seed = cfg.seed ?? 1;
  const tutorial = !!cfg.tutorial;
  const [player, s1] = makeSide(cfg.playerDeck, cfg.playerLevels ?? {}, seed, tutorial);
  const [ai, s2] = makeSide(cfg.aiDeck, cfg.aiLevels ?? {}, s1, false);
  seed = s2;
  ai.energyRate = cfg.aiEnergyRate ?? 1;
  if (tutorial) {
    player.energy = MAX_ENERGY;
    ai.lighthouse = ai.lighthouseMax = Math.round(LIGHTHOUSE_HP * 0.55);
  }
  return {
    sea: cfg.sea,
    time: 0,
    duration: cfg.duration ?? MATCH_DURATION,
    tide: 'low',
    tideLeft: TIDE_PERIOD,
    water: 0,
    paused: false,
    aiActive: !tutorial,
    players: { player, ai },
    units: [],
    structures: [],
    events: [],
    result: null,
    nextId: 1,
    seed,
    tutorial,
    stats: { drowned: { player: 0, ai: 0 }, stranded: { player: 0, ai: 0 } },
  };
}

// ---------- playing cards ----------

export type PlayError = 'energy' | 'lane' | 'card' | 'over';

export function canPlay(state: MatchState, side: Side, handIndex: number): PlayError | null {
  if (state.result) return 'over';
  const p = state.players[side];
  const card = p.hand[handIndex];
  if (!card) return 'card';
  if (p.energy + 1e-6 < CARDS[card].cost) return 'energy';
  return null;
}

export function playCard(state: MatchState, side: Side, handIndex: number, lane: Lane | null): PlayError | null {
  const err = canPlay(state, side, handIndex);
  if (err) return err;
  const p = state.players[side];
  const id = p.hand[handIndex];
  const def = CARDS[id];
  if (def.needsLane && lane === null) return 'lane';
  p.energy -= def.cost;
  // Cycle: the played card goes to the back of the queue, the front of the queue comes to hand.
  p.hand[handIndex] = p.queue.shift()!;
  p.queue.push(id);
  state.events.push({ type: 'play', side, card: id, lane });
  const lv = levelBoost(p.levels[id]);

  if (def.unit && lane !== null) {
    const u = def.unit;
    const count = u.count ?? 1;
    for (let i = 0; i < count; i++) {
      const hp = Math.round(u.hp * lv);
      state.units.push({
        id: state.nextId++,
        side,
        card: id,
        kind: def.kind === 'boat' ? 'boat' : 'creature',
        lane,
        d: fromProgress(side, 0.01 + i * 0.012),
        x: count > 1 ? (i - (count - 1) / 2) * 0.32 : 0,
        hp,
        maxHp: hp,
        dmg: u.dmg * lv,
        interval: u.interval,
        cooldown: 0.3,
        range: u.range,
        speed: u.speed,
        amphibious: !!u.amphibious,
        explode: u.explode ? { dmg: u.explode.dmg * lv, radius: u.explode.radius } : undefined,
        state: 'wait',
        hurt: 9,
      });
    }
    return null;
  }

  if (lane !== null && id === 'puente') {
    state.structures = state.structures.filter((s) => !(s.kind === 'bridge' && s.side === side && s.lane === lane));
    addStructure(state, { side, card: id, kind: 'bridge', lane, d: 0.5, hp: 1, ttl: BRIDGE_TTL });
  } else if (lane !== null && id === 'dique') {
    addStructure(state, {
      side,
      card: id,
      kind: 'wall',
      lane,
      d: fromProgress(side, WALL.d),
      hp: Math.round(WALL.hp * lv),
      ttl: WALL.ttl,
    });
  } else if (lane !== null && id === 'erizos') {
    addStructure(state, { side, card: id, kind: 'trap', lane, d: fromProgress(side, TRAP.d), hp: 1, ttl: TRAP.ttl });
  } else if (lane !== null && id === 'ola') {
    state.events.push({ type: 'wave', lane, side });
    for (const u of state.units) {
      if (u.side === side || u.lane !== lane) continue;
      damageUnit(state, u, WAVE.dmg * lv, side);
      const back = Math.max(0.01, progress(u.side, u.d) - WAVE.push);
      u.d = fromProgress(u.side, back);
    }
    for (const s of state.structures) {
      if (s.side !== side && s.lane === lane && s.kind === 'wall') s.hp -= WAVE.dmg * lv;
    }
  } else if (id === 'mareaviva') {
    switchTide(state);
  }
  return null;
}

function addStructure(state: MatchState, s: Omit<Structure, 'id' | 'maxHp' | 'maxTtl'>) {
  state.structures.push({ ...s, id: state.nextId++, maxHp: s.hp, maxTtl: s.ttl });
}

function switchTide(state: MatchState) {
  state.tide = state.tide === 'low' ? 'high' : 'low';
  state.tideLeft = TIDE_PERIOD;
  state.events.push({ type: 'tide', tide: state.tide });
}

// ---------- simulation ----------

const onBeach = (d: number) => d < BEACH || d > 1 - BEACH;

export function hasBridge(state: MatchState, side: Side, lane: Lane) {
  return state.structures.some((s) => s.kind === 'bridge' && s.side === side && s.lane === lane);
}

function damageUnit(state: MatchState, u: Unit, amount: number, by: Side) {
  u.hp -= amount;
  u.hurt = 0;
  state.events.push({ type: 'hit', lane: u.lane, d: u.d, side: by });
}

/** Closest rival unit or wall on the lane within reach, or null. */
function findTarget(state: MatchState, u: Unit): Unit | Structure | null {
  let best: Unit | Structure | null = null;
  let bestDist = Infinity;
  const reach = u.range + 0.02;
  for (const o of state.units) {
    if (o.side === u.side || o.lane !== u.lane || o.hp <= 0) continue;
    const dist = Math.abs(o.d - u.d);
    if (dist <= reach && dist < bestDist) {
      best = o;
      bestDist = dist;
    }
  }
  for (const s of state.structures) {
    if (s.side === u.side || s.lane !== u.lane || s.kind !== 'wall' || s.hp <= 0) continue;
    const dist = Math.abs(s.d - u.d);
    if (dist <= reach && dist < bestDist) {
      best = s;
      bestDist = dist;
    }
  }
  return best;
}

function explode(state: MatchState, u: Unit) {
  if (!u.explode) return;
  state.events.push({ type: 'boom', lane: u.lane, d: u.d });
  for (const o of state.units) {
    if (o.side !== u.side && o.lane === u.lane && Math.abs(o.d - u.d) <= u.explode.radius) {
      damageUnit(state, o, u.explode.dmg, u.side);
    }
  }
  for (const s of state.structures) {
    if (s.side !== u.side && s.lane === u.lane && s.kind === 'wall' && Math.abs(s.d - u.d) <= u.explode.radius) {
      s.hp -= u.explode.dmg;
    }
  }
  if (progress(u.side, u.d) >= FRONT - 0.01) hitLighthouse(state, other(u.side), u.explode.dmg);
  u.hp = 0;
}

function hitLighthouse(state: MatchState, side: Side, amount: number) {
  const p = state.players[side];
  p.lighthouse = Math.max(0, p.lighthouse - amount);
  state.events.push({ type: 'lighthouse', side });
}

export function step(state: MatchState, dt: number) {
  if (state.paused || state.result) return;
  dt = Math.min(dt, 0.1);
  state.time += dt;
  state.tideLeft -= dt;
  if (state.tideLeft <= 0) switchTide(state);
  const target = state.tide === 'high' ? 1 : 0;
  state.water += Math.sign(target - state.water) * Math.min(Math.abs(target - state.water), WATER_SPEED * dt);

  for (const side of ['player', 'ai'] as Side[]) {
    const p = state.players[side];
    if (!(state.tutorial && side === 'ai' && !state.aiActive)) {
      const rush = state.duration - state.time <= RUSH_TIME ? 2 : 1;
      p.energy = Math.min(MAX_ENERGY, p.energy + ENERGY_PER_SEC * rush * p.energyRate * dt);
    }
  }
  const high = state.tide === 'high';
  // The tide counts once the water has really moved, so there is a short grace moment.
  const covered = state.water > 0.6;
  const dry = state.water < 0.4;

  for (const u of state.units) {
    if (u.hp <= 0) continue;
    u.cooldown -= dt;
    u.hurt += dt;
    const p = progress(u.side, u.d);
    const beach = onBeach(u.d);
    let canMove = true;
    if (u.kind === 'creature') {
      const safe = beach || u.amphibious || hasBridge(state, u.side, u.lane);
      if (covered && !safe) {
        u.state = 'drowning';
        u.hp -= u.maxHp * DROWN_RATE * dt;
        if (u.hp <= 0) state.stats.drowned[u.side]++;
        continue;
      }
      // Wait on its own beach while the sand is covered.
      if (high && p < BEACH && !u.amphibious && !hasBridge(state, u.side, u.lane)) canMove = false;
    } else {
      if (dry && !beach) {
        u.state = 'stranded';
        u.hp -= u.maxHp * STRAND_RATE * dt;
        if (u.hp <= 0) state.stats.stranded[u.side]++;
        canMove = false;
      } else if (!high && p < BEACH) {
        canMove = false;
      }
      if (state.sea === 'arrecife' && u.lane === 1 && u.d > CORAL.from && u.d < CORAL.to && !dry) {
        u.hp -= CORAL.dps * dt;
      }
    }

    const tgt = findTarget(state, u);
    const atFront = p >= FRONT - 0.005;
    const reachesLighthouse = 1 - p <= u.range + 0.06;
    if (tgt || (atFront && reachesLighthouse) || (reachesLighthouse && u.range > 0.1 && p > 0.6)) {
      if (u.state !== 'stranded') u.state = 'fight';
      if (u.cooldown <= 0) {
        u.cooldown = u.interval;
        if (u.explode) {
          explode(state, u);
        } else if (tgt) {
          if ('kind' in tgt && (tgt.kind === 'wall' || tgt.kind === 'trap' || tgt.kind === 'bridge')) {
            tgt.hp -= u.dmg;
            state.events.push({ type: 'hit', lane: tgt.lane, d: tgt.d, side: u.side });
          } else {
            damageUnit(state, tgt as Unit, u.dmg, u.side);
          }
        } else {
          hitLighthouse(state, other(u.side), u.dmg);
        }
      }
      continue;
    }
    if (!canMove) {
      if (u.state !== 'stranded') u.state = 'wait';
      continue;
    }
    u.state = 'move';
    u.d = fromProgress(u.side, Math.min(FRONT, p + u.speed * dt));
  }

  // Traps.
  for (const s of state.structures) {
    if (s.kind !== 'trap') continue;
    for (const u of state.units) {
      if (u.side !== s.side && u.kind === 'creature' && u.lane === s.lane && Math.abs(u.d - s.d) <= TRAP.radius) {
        u.hp -= TRAP.dps * dt;
        u.hurt = 0;
      }
    }
  }

  // Lighthouses shoot the closest rival near their island.
  for (const side of ['player', 'ai'] as Side[]) {
    const lh = state.players[side];
    lh.beamCooldown -= dt;
    if (lh.beamCooldown > 0) continue;
    let best: Unit | null = null;
    let bestP = -1;
    for (const u of state.units) {
      if (u.side === side || u.hp <= 0) continue;
      const p = progress(u.side, u.d);
      if (p >= 1 - LIGHTHOUSE.reach && p > bestP) {
        best = u;
        bestP = p;
      }
    }
    if (best) {
      lh.beamCooldown = LIGHTHOUSE.interval;
      state.events.push({ type: 'beam', side, lane: best.lane, d: best.d });
      damageUnit(state, best, LIGHTHOUSE.dmg, side);
    }
  }

  // Cleanup.
  const alive: Unit[] = [];
  for (const u of state.units) {
    if (u.hp > 0) alive.push(u);
    else
      state.events.push({
        type: 'death',
        lane: u.lane,
        d: u.d,
        kind: u.kind,
        drowned: u.state === 'drowning' || u.state === 'stranded',
      });
  }
  state.units = alive;
  state.structures = state.structures.filter((s) => {
    s.ttl -= dt;
    if (s.kind === 'wall' && s.hp <= 0) {
      state.events.push({ type: 'death', lane: s.lane, d: s.d, kind: 'wall', drowned: false });
      return false;
    }
    return s.ttl > 0;
  });

  // Result.
  const pl = state.players.player.lighthouse;
  const ai = state.players.ai.lighthouse;
  if (pl <= 0 || ai <= 0) {
    state.result = ai <= 0 && pl > 0 ? 'win' : pl <= 0 && ai > 0 ? 'lose' : 'draw';
  } else if (state.time >= state.duration) {
    const a = pl / state.players.player.lighthouseMax;
    const b = ai / state.players.ai.lighthouseMax;
    state.result = Math.abs(a - b) < 0.005 ? 'draw' : a > b ? 'win' : 'lose';
  }
}

/** Takes the events produced since the last call (the 3D scene turns them into effects). */
export function drainEvents(state: MatchState) {
  const e = state.events;
  state.events = [];
  return e;
}
