/**
 * The match simulation. Plain, mutable TypeScript (no React) so it can run every frame
 * on the phone and be tested headless.
 *
 * Rules in one place:
 * - The map is an archipelago: your home island, the rival's, and small islands in between.
 * - The tide changes every TIDE_PERIOD seconds. Each low tide uncovers a different set of sandbars.
 * - You send every creature or boat to an island. It goes there, conquers it if nobody defends it,
 *   and stays to guard it. If it is the rival's home, it attacks the lighthouse.
 * - Creatures walk the uncovered sandbars. If the tide rises while one is on a sandbar, it drowns
 *   (unless it swims, or a bridge of its own covers that sandbar). Islands are always dry.
 * - Boats sail straight across at high tide. If the tide falls while one is out on the water,
 *   it runs aground and slowly breaks.
 * - Conquered islands help: Perla islands give extra energy, Roca islands have a cannon.
 * - The first lighthouse to go dark loses. At the end of time, more light left wins.
 */
import { BRIDGE_TTL, CARDS, HAND_SIZE, TRAP, WALL, WAVE, levelBoost } from './cards';
import { ARCHIPELAGO, HOME, barBetween, barPoint, dist, findPath, islandAt, rollBars } from './map';
import { shuffle } from './rng';
import type { Bar, CardId, MatchConfig, MatchState, Side, SidePlayer, Structure, Unit } from './types';

export const TIDE_PERIOD = 20;
export const MATCH_DURATION = 180;
export const MAX_ENERGY = 10;
export const ENERGY_PER_SEC = 0.5;
export const LIGHTHOUSE_HP = 1500;
export const LIGHTHOUSE = { dmg: 60, interval: 1, reach: 2.6 };
/** In the last minute energy comes twice as fast. */
export const RUSH_TIME = 60;
export const DROWN_RATE = 0.55;
export const STRAND_RATE = 0.14;
export const CAPTURE_RATE = 0.5;
export const ISLAND_BONUS = { energy: 0.12, bigEnergy: 0.2 };
export const FORT = { dmg: 45, interval: 1.2, reach: 3.2 };
export const CORAL = { radius: 2.6, dps: 45 };
/** How fast the water level animates between tides (per second). */
const WATER_SPEED = 1.6;

export const SIDES: Side[] = ['player', 'ai'];
export const other = (s: Side): Side => (s === 'player' ? 'ai' : 'player');

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
  const tutorial = !!cfg.tutorial;
  const [player, s1] = makeSide(cfg.playerDeck, cfg.playerLevels ?? {}, cfg.seed ?? 1, tutorial);
  const [ai, s2] = makeSide(cfg.aiDeck, cfg.aiLevels ?? {}, s1, false);
  ai.energyRate = cfg.aiEnergyRate ?? 1;
  if (tutorial) {
    player.energy = MAX_ENERGY;
    ai.lighthouse = ai.lighthouseMax = Math.round(LIGHTHOUSE_HP * 0.55);
  }
  const map = ARCHIPELAGO;
  const state: MatchState = {
    sea: cfg.sea,
    time: 0,
    duration: cfg.duration ?? MATCH_DURATION,
    tide: 'low',
    tideLeft: TIDE_PERIOD,
    water: 0,
    paused: false,
    aiActive: !tutorial,
    players: { player, ai },
    map,
    islands: map.islands.map((i) => ({
      owner: i.home ?? null,
      capture: i.home === 'player' ? 1 : i.home === 'ai' ? -1 : 0,
      cooldown: 0,
    })),
    openBars: [],
    units: [],
    structures: [],
    events: [],
    result: null,
    nextId: 1,
    seed: s2,
    tutorial,
    stats: { drowned: { player: 0, ai: 0 }, stranded: { player: 0, ai: 0 } },
  };
  // The guided match always starts with the same easy sandbars (straight up the middle).
  state.openBars = tutorial ? [0, 1, 4, 5, 6, 7] : rollBars(state);
  return state;
}

// ---------- playing cards ----------

export type PlayError = 'energy' | 'target' | 'card' | 'over';

export function canPlay(state: MatchState, side: Side, handIndex: number): PlayError | null {
  if (state.result) return 'over';
  const p = state.players[side];
  const card = p.hand[handIndex];
  if (!card) return 'card';
  if (p.energy + 1e-6 < CARDS[card].cost) return 'energy';
  return null;
}

export function playCard(state: MatchState, side: Side, handIndex: number, island: number | null): PlayError | null {
  const err = canPlay(state, side, handIndex);
  if (err) return err;
  const p = state.players[side];
  const id = p.hand[handIndex];
  const def = CARDS[id];
  if (def.needsTarget && (island === null || !state.map.islands[island])) return 'target';
  p.energy -= def.cost;
  // Cycle: the played card goes to the back of the queue, the front of the queue comes to hand.
  p.hand[handIndex] = p.queue.shift()!;
  p.queue.push(id);
  state.events.push({ type: 'play', side, card: id, island });
  const lv = levelBoost(p.levels[id]);
  const home = state.map.islands[HOME[side]];

  if (def.unit && island !== null) {
    const u = def.unit;
    const count = u.count ?? 1;
    const goal = state.map.islands[island];
    const boat = def.kind === 'boat';
    // Boats wait at the shore facing their goal; creatures gather in front of the lighthouse.
    const dx = goal.x - home.x;
    const dz = goal.z - home.z;
    const dl = Math.hypot(dx, dz) || 1;
    const sx = boat ? home.x + (dx / dl) * home.r * 0.95 : home.x + (dx / dl) * home.r * 0.45;
    const sz = boat ? home.z + (dz / dl) * home.r * 0.95 : home.z + (dz / dl) * home.r * 0.45;
    for (let i = 0; i < count; i++) {
      const hp = Math.round(u.hp * lv);
      const spread = count > 1 ? (i - (count - 1) / 2) * 0.42 : 0;
      state.units.push({
        id: state.nextId++,
        side,
        card: id,
        kind: boat ? 'boat' : 'creature',
        x: sx,
        z: sz,
        node: HOME[side],
        next: null,
        t: 0,
        goal: island,
        ox: spread,
        oz: count > 1 ? Math.abs(spread) * 0.4 : 0,
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

  const target = island !== null ? state.map.islands[island] : null;
  if (target && id === 'puente') {
    state.structures = state.structures.filter((s) => !(s.kind === 'bridge' && s.side === side && s.island === island));
    addStructure(state, {
      side,
      card: id,
      kind: 'bridge',
      island: target.id,
      x: target.x,
      z: target.z,
      hp: 1,
      ttl: BRIDGE_TTL,
    });
  } else if (target && id === 'dique') {
    const toward = state.map.islands[HOME[other(side)]];
    const d = dist(target.x, target.z, toward.x, toward.z) || 1;
    const k = target.kind === 'home' ? target.r * 0.75 : target.r * 0.6;
    addStructure(state, {
      side,
      card: id,
      kind: 'wall',
      island: target.id,
      x: target.x + ((toward.x - target.x) / d) * k,
      z: target.z + ((toward.z - target.z) / d) * k,
      hp: Math.round(WALL.hp * lv),
      ttl: WALL.ttl,
    });
  } else if (target && id === 'erizos') {
    addStructure(state, {
      side,
      card: id,
      kind: 'trap',
      island: target.id,
      x: target.x,
      z: target.z,
      hp: 1,
      ttl: TRAP.ttl,
    });
  } else if (target && id === 'ola') {
    state.events.push({ type: 'wave', x: target.x, z: target.z, side });
    for (const u of state.units) {
      if (u.side === side || dist(u.x, u.z, target.x, target.z) > WAVE.radius + target.r) continue;
      damageUnit(state, u, WAVE.dmg * lv, side);
      pushBack(state, u, WAVE.push);
    }
    for (const s of state.structures) {
      if (s.side !== side && s.kind === 'wall' && s.island === target.id) s.hp -= WAVE.dmg * lv;
    }
  } else if (id === 'mareaviva') {
    switchTide(state);
  }
  return null;
}

function addStructure(state: MatchState, s: Omit<Structure, 'id' | 'maxHp' | 'maxTtl'>) {
  state.structures.push({ ...s, id: state.nextId++, maxHp: s.hp, maxTtl: s.ttl });
}

/** Moves a unit back toward its own home. */
function pushBack(state: MatchState, u: Unit, amount: number) {
  if (u.kind === 'creature' && u.next !== null) {
    const { len } = barPoint(state.map, u.node, u.next, u.t);
    u.t = Math.max(0, u.t - amount / len);
    if (u.t === 0) u.next = null;
    const p = barPoint(state.map, u.node, u.next ?? u.node, u.t);
    u.x = p.x;
    u.z = p.z;
    return;
  }
  if (u.kind === 'boat') {
    const home = state.map.islands[HOME[u.side]];
    const d = dist(u.x, u.z, home.x, home.z) || 1;
    const k = Math.min(amount, d - home.r);
    u.x += ((home.x - u.x) / d) * k;
    u.z += ((home.z - u.z) / d) * k;
  }
}

function switchTide(state: MatchState) {
  state.tide = state.tide === 'low' ? 'high' : 'low';
  state.tideLeft = TIDE_PERIOD;
  // While the water is up, the next low tide's sandbars are already chosen (and visible under water).
  if (state.tide === 'high') state.openBars = rollBars(state);
  state.events.push({ type: 'tide', tide: state.tide });
}

// ---------- helpers ----------

export function bridgeAt(state: MatchState, side: Side, island: number) {
  return state.structures.some((s) => s.kind === 'bridge' && s.side === side && s.island === island);
}

/** Has `side` a bridge on this sandbar (a bridge covers every sandbar touching its island)? */
export function bridged(state: MatchState, side: Side, bar: Bar) {
  return bridgeAt(state, side, bar.a) || bridgeAt(state, side, bar.b);
}

/** Can a creature of `side` start walking this sandbar right now? */
export function walkable(state: MatchState, side: Side, bar: Bar, amphibious = false) {
  if (amphibious) return true;
  if (bridged(state, side, bar)) return true;
  return state.water < 0.4 && state.openBars.includes(bar.id);
}

function damageUnit(state: MatchState, u: Unit, amount: number, by: Side) {
  u.hp -= amount;
  u.hurt = 0;
  state.events.push({ type: 'hit', x: u.x, z: u.z, side: by });
}

/** Closest rival unit or wall within reach, or null. */
function findTarget(state: MatchState, u: Unit): Unit | Structure | null {
  let best: Unit | Structure | null = null;
  let bestDist = Infinity;
  for (const o of state.units) {
    if (o.side === u.side || o.hp <= 0) continue;
    const d = dist(o.x, o.z, u.x, u.z);
    if (d <= u.range + 0.25 && d < bestDist) {
      best = o;
      bestDist = d;
    }
  }
  for (const s of state.structures) {
    if (s.side === u.side || s.kind !== 'wall' || s.hp <= 0) continue;
    const d = dist(s.x, s.z, u.x, u.z);
    if (d <= u.range + 0.7 && d < bestDist) {
      best = s;
      bestDist = d;
    }
  }
  return best;
}

/** Is the unit close enough to hit the rival lighthouse? */
function atRivalLighthouse(state: MatchState, u: Unit) {
  const home = state.map.islands[HOME[other(u.side)]];
  const d = dist(u.x, u.z, home.x, home.z);
  // Creatures must be on the island itself; boats shoot from the shore.
  return u.kind === 'creature' ? d <= home.r * 0.7 : d <= home.r + u.range;
}

function explode(state: MatchState, u: Unit) {
  if (!u.explode) return;
  state.events.push({ type: 'boom', x: u.x, z: u.z });
  for (const o of state.units) {
    if (o.side !== u.side && dist(o.x, o.z, u.x, u.z) <= u.explode.radius) damageUnit(state, o, u.explode.dmg, u.side);
  }
  for (const s of state.structures) {
    if (s.side !== u.side && s.kind === 'wall' && dist(s.x, s.z, u.x, u.z) <= u.explode.radius + 0.5) {
      s.hp -= u.explode.dmg;
    }
  }
  if (atRivalLighthouse(state, u)) hitLighthouse(state, other(u.side), u.explode.dmg);
  u.hp = 0;
}

function hitLighthouse(state: MatchState, side: Side, amount: number) {
  const p = state.players[side];
  p.lighthouse = Math.max(0, p.lighthouse - amount);
  state.events.push({ type: 'lighthouse', side });
}

// ---------- movement ----------

function moveCreature(state: MatchState, u: Unit, dt: number, covered: boolean) {
  const map = state.map;
  if (u.next !== null) {
    const bar = barBetween(map, u.node, u.next)!;
    const here = barPoint(map, u.node, u.next, u.t);
    if (covered && !here.onLand && !u.amphibious && !bridged(state, u.side, bar)) {
      u.state = 'drowning';
      u.hp -= u.maxHp * DROWN_RATE * dt;
      if (u.hp <= 0) state.stats.drowned[u.side]++;
      return;
    }
    // Swimmers go slower in deep water.
    const slow = u.amphibious && covered && !here.onLand ? 0.75 : 1;
    u.t = Math.min(1, u.t + (u.speed * slow * dt) / here.len);
    const p = barPoint(map, u.node, u.next, u.t);
    u.x = p.x;
    u.z = p.z;
    u.state = 'move';
    if (u.t >= 1) {
      u.node = u.next;
      u.next = null;
      u.t = 0;
    }
    return;
  }
  const island = map.islands[u.node];
  if (u.node === u.goal) {
    // Settle on the island, away from its centre a little so a group spreads out.
    const tx = island.x + u.ox;
    const tz = island.z + u.oz + (island.kind === 'home' ? (u.side === 'player' ? -1 : 1) * island.r * 0.55 : 0);
    const d = dist(u.x, u.z, tx, tz);
    if (d > 0.05) {
      const k = Math.min(1, (u.speed * dt) / d);
      u.x += (tx - u.x) * k;
      u.z += (tz - u.z) * k;
      u.state = 'move';
    } else u.state = state.islands[u.node].owner === u.side ? 'guard' : 'capture';
    return;
  }
  const path = findPath(map, u.node, u.goal, (b) => walkable(state, u.side, b, u.amphibious));
  if (!path || path.length < 2) {
    u.state = 'wait';
    return;
  }
  u.next = path[1];
  u.t = 0;
  u.state = 'move';
}

function moveBoat(state: MatchState, u: Unit, dt: number, sailing: boolean, dry: boolean) {
  const map = state.map;
  const land = islandAt(map, u.x, u.z, 0.35);
  if (land) u.node = land.id;
  if (dry && !land) {
    u.state = 'stranded';
    u.hp -= u.maxHp * STRAND_RATE * dt;
    if (u.hp <= 0) state.stats.stranded[u.side]++;
    return;
  }
  const goal = map.islands[u.goal];
  // Boats stop at the goal's shore.
  const d = dist(u.x, u.z, goal.x, goal.z);
  const stop = goal.r * 0.95;
  if (d <= stop + 0.05) {
    u.node = goal.id;
    u.state = state.islands[goal.id].owner === u.side ? 'guard' : 'capture';
    return;
  }
  if (!sailing) {
    u.state = 'wait';
    return;
  }
  // Steer around any island in the way instead of sailing over it.
  let tx = goal.x;
  let tz = goal.z;
  for (const isl of map.islands) {
    if (isl.id === goal.id || (land && isl.id === land.id)) continue;
    const ax = goal.x - u.x;
    const az = goal.z - u.z;
    const along = ((isl.x - u.x) * ax + (isl.z - u.z) * az) / (d * d);
    if (along <= 0 || along >= 1) continue;
    const px = u.x + ax * along - isl.x;
    const pz = u.z + az * along - isl.z;
    const off = Math.hypot(px, pz);
    const clear = isl.r + 0.7;
    if (off >= clear) continue;
    // Aim for the side of the island the course already leans to.
    const nx = off > 0.01 ? px / off : -az / d;
    const nz = off > 0.01 ? pz / off : ax / d;
    tx = isl.x + nx * (clear + 0.3);
    tz = isl.z + nz * (clear + 0.3);
    break;
  }
  const td = dist(u.x, u.z, tx, tz) || 1;
  const k = Math.min(tx === goal.x && tz === goal.z ? d - stop : td, u.speed * dt) / td;
  u.x += (tx - u.x) * k;
  u.z += (tz - u.z) * k;
  u.state = 'move';
}

// ---------- step ----------

export function step(state: MatchState, dt: number) {
  if (state.paused || state.result) return;
  dt = Math.min(dt, 0.1);
  state.time += dt;
  state.tideLeft -= dt;
  if (state.tideLeft <= 0) switchTide(state);
  const target = state.tide === 'high' ? 1 : 0;
  state.water += Math.sign(target - state.water) * Math.min(Math.abs(target - state.water), WATER_SPEED * dt);
  // The tide counts once the water has really moved, so there is a short grace moment.
  const covered = state.water > 0.6;
  const dry = state.water < 0.4;

  for (const side of SIDES) {
    const p = state.players[side];
    if (state.tutorial && side === 'ai' && !state.aiActive) continue;
    const rush = state.duration - state.time <= RUSH_TIME ? 2 : 1;
    let gain = ENERGY_PER_SEC * rush * p.energyRate;
    state.map.islands.forEach((isl, i) => {
      if (isl.kind === 'energy' && state.islands[i].owner === side) {
        gain += isl.r > 1.5 ? ISLAND_BONUS.bigEnergy : ISLAND_BONUS.energy;
      }
    });
    p.energy = Math.min(MAX_ENERGY, p.energy + gain * dt);
  }

  for (const u of state.units) {
    if (u.hp <= 0) continue;
    u.cooldown -= dt;
    u.hurt += dt;

    const tgt = u.state === 'drowning' ? null : findTarget(state, u);
    const atLighthouse = atRivalLighthouse(state, u);
    if (tgt || atLighthouse) {
      // Stranded boats still shoot; drowning creatures can't fight.
      if (u.kind === 'boat' && dry && !islandAt(state.map, u.x, u.z, 0.35)) {
        moveBoat(state, u, dt, false, true);
      } else if (u.kind === 'creature' && u.next !== null && covered) {
        moveCreature(state, u, dt, covered);
        if (u.state === 'drowning') continue;
      } else {
        u.state = 'fight';
      }
      if (u.cooldown <= 0 && u.hp > 0) {
        u.cooldown = u.interval;
        if (u.explode) explode(state, u);
        else if (tgt && 'island' in tgt) {
          tgt.hp -= u.dmg;
          state.events.push({ type: 'hit', x: tgt.x, z: tgt.z, side: u.side });
        } else if (tgt) damageUnit(state, tgt as Unit, u.dmg, u.side);
        else hitLighthouse(state, other(u.side), u.dmg);
      }
      continue;
    }
    if (u.kind === 'creature') moveCreature(state, u, dt, covered);
    else moveBoat(state, u, dt, covered, dry);
    if (state.sea === 'arrecife' && u.kind === 'boat' && !dry) {
      const c = state.map.islands[4];
      if (dist(u.x, u.z, c.x, c.z) < CORAL.radius) u.hp -= CORAL.dps * dt;
    }
  }

  // Traps.
  for (const s of state.structures) {
    if (s.kind !== 'trap') continue;
    for (const u of state.units) {
      if (u.side !== s.side && u.kind === 'creature' && dist(u.x, u.z, s.x, s.z) <= TRAP.radius) {
        u.hp -= TRAP.dps * dt;
        u.hurt = 0;
      }
    }
  }

  // Islands: capture, and cannons on Roca islands.
  state.map.islands.forEach((isl, i) => {
    const st = state.islands[i];
    if (isl.kind === 'home') return;
    let mine = 0;
    let theirs = 0;
    for (const u of state.units) {
      if (dist(u.x, u.z, isl.x, isl.z) > isl.r + 0.4) continue;
      if (u.side === 'player') mine++;
      else theirs++;
    }
    const wall = (side: Side) => state.structures.some((s) => s.kind === 'wall' && s.island === i && s.side === side);
    if (mine && !theirs && !wall('ai')) st.capture = Math.min(1, st.capture + CAPTURE_RATE * dt);
    if (theirs && !mine && !wall('player')) st.capture = Math.max(-1, st.capture - CAPTURE_RATE * dt);
    const before = st.owner;
    if (st.capture >= 1) st.owner = 'player';
    else if (st.capture <= -1) st.owner = 'ai';
    else if ((st.owner === 'player' && st.capture <= 0) || (st.owner === 'ai' && st.capture >= 0)) st.owner = null;
    if (st.owner && st.owner !== before) state.events.push({ type: 'capture', island: i, side: st.owner });

    if (isl.kind === 'fort' && st.owner) {
      st.cooldown -= dt;
      if (st.cooldown <= 0) {
        const foe = nearestFoe(state, st.owner, isl.x, isl.z, FORT.reach + isl.r);
        if (foe) {
          st.cooldown = FORT.interval;
          state.events.push({
            type: 'beam',
            side: st.owner,
            fromX: isl.x,
            fromZ: isl.z,
            x: foe.x,
            z: foe.z,
            tall: false,
          });
          damageUnit(state, foe, FORT.dmg, st.owner);
        }
      }
    }
  });

  // Lighthouses shoot the closest rival near their island.
  for (const side of SIDES) {
    const lh = state.players[side];
    lh.beamCooldown -= dt;
    if (lh.beamCooldown > 0) continue;
    const home = state.map.islands[HOME[side]];
    const foe = nearestFoe(state, side, home.x, home.z, home.r + LIGHTHOUSE.reach);
    if (foe) {
      lh.beamCooldown = LIGHTHOUSE.interval;
      state.events.push({ type: 'beam', side, fromX: home.x, fromZ: home.z, x: foe.x, z: foe.z, tall: true });
      damageUnit(state, foe, LIGHTHOUSE.dmg, side);
    }
  }

  // Cleanup.
  const alive: Unit[] = [];
  for (const u of state.units) {
    if (u.hp > 0) alive.push(u);
    else
      state.events.push({
        type: 'death',
        x: u.x,
        z: u.z,
        kind: u.kind,
        drowned: u.state === 'drowning' || u.state === 'stranded',
      });
  }
  state.units = alive;
  state.structures = state.structures.filter((s) => {
    s.ttl -= dt;
    if (s.kind === 'wall' && s.hp <= 0) {
      state.events.push({ type: 'death', x: s.x, z: s.z, kind: 'wall', drowned: false });
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

function nearestFoe(state: MatchState, side: Side, x: number, z: number, reach: number): Unit | null {
  let best: Unit | null = null;
  let bestD = reach;
  for (const u of state.units) {
    if (u.side === side || u.hp <= 0) continue;
    const d = dist(u.x, u.z, x, z);
    if (d <= bestD) {
      best = u;
      bestD = d;
    }
  }
  return best;
}

/** Islands owned by a side (not counting homes). */
export const islandsOf = (state: MatchState, side: Side) =>
  state.map.islands.filter((i, k) => i.kind !== 'home' && state.islands[k].owner === side).length;

/** Takes the events produced since the last call (the 3D scene turns them into effects). */
export function drainEvents(state: MatchState) {
  const e = state.events;
  state.events = [];
  return e;
}
