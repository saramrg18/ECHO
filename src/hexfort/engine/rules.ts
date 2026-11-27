/** HEXFORT rules: pure functions over MatchState. Every action returns a new state + events. */
import { CARDS, SYNERGIES } from './cards';
import { distanceById, neighborIds } from './hex';
import { parseMap, type MapDef } from './maps';
import type { Action, ActionResult, BuildingKind, CardId, Cell, GameEvent, MatchState, Side, SideState } from './types';

export const START_HAND = 4;
export const MAX_HAND = 7;
export const MAX_ENERGY = 10;
export const START_ENERGY = 3;
export const ENERGY_PER_TURN = 2;

export const other = (s: Side): Side => (s === 'player' ? 'ai' : 'player');

// ---------- random (seeded, deterministic) ----------

function nextRandom(state: MatchState): number {
  let t = (state.rng = (state.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function shuffle<T>(state: MatchState, list: T[]): T[] {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(nextRandom(state) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- queries ----------

export function cellsOf(state: MatchState, side: Side): Cell[] {
  return state.order.map((id) => state.cells[id]).filter((c) => c.owner === side);
}

export function neighbors(state: MatchState, id: string): Cell[] {
  return neighborIds(id)
    .map((n) => state.cells[n])
    .filter((c): c is Cell => !!c && c.terrain !== 'water');
}

/** Synergies currently active on a cell's building. */
export function activeSynergies(state: MatchState, id: string) {
  const cell = state.cells[id];
  if (!cell?.building || cell.owner === 'neutral') return [];
  const near = neighbors(state, id).filter((n) => n.owner === cell.owner && n.building);
  return SYNERGIES.filter((s) => s.building === cell.building && near.some((n) => n.building === s.partner));
}

const hasSynergy = (state: MatchState, id: string, synergy: string) =>
  activeSynergies(state, id).some((s) => s.id === synergy);

/** Defence added on top of the troops of a cell. */
export function defenseBonus(state: MatchState, id: string): number {
  const c = state.cells[id];
  let bonus = 0;
  if (c.terrain === 'forest' || c.terrain === 'hill') bonus += 1;
  if (c.building === 'base') bonus += 2;
  if (c.building === 'guard') bonus += 2 + (hasSynergy(state, id, 'wall') ? 1 : 0);
  return bonus;
}

export const defenseOf = (state: MatchState, id: string) => state.cells[id].troops + defenseBonus(state, id);

export function canMove(state: MatchState, from: string, to: string): string | null {
  if (state.winner) return 'La partida ha terminado.';
  const a = state.cells[from];
  const b = state.cells[to];
  if (!a || !b) return 'Casilla no válida.';
  if (a.owner !== state.turn) return 'Esa casilla no es tuya.';
  if (a.acted) return 'Esa casilla ya se ha movido este turno.';
  if (a.troops < 2) return 'Necesitas al menos 2 tropas para moverte.';
  if (b.terrain === 'water') return 'No se puede entrar en el agua.';
  if (!neighborIds(from).includes(to)) return 'Solo puedes moverte a una casilla vecina.';
  if (b.owner !== state.turn && b.shielded) return 'Esa casilla tiene un escudo.';
  return null;
}

/** Valid targets for the card at hand index. */
export function cardTargets(state: MatchState, index: number): string[] {
  const side = state.turn;
  const card = state.sides[side].hand[index];
  if (!card) return [];
  const def = CARDS[card];
  return state.order.filter((id) => {
    const c = state.cells[id];
    if (c.terrain === 'water') return false;
    switch (def.target) {
      case 'own-empty':
        return c.owner === side && !c.building;
      case 'own':
        return c.owner === side;
      case 'foe':
        return c.owner !== side && !c.shielded;
      case 'foe-building':
        return c.owner === other(side) && !!c.building && c.building !== 'base';
      case 'none':
        return false;
    }
  });
}

export function canPlayCard(state: MatchState, index: number, target?: string): string | null {
  if (state.winner) return 'La partida ha terminado.';
  const side = state.sides[state.turn];
  const card = side.hand[index];
  if (!card) return 'No tienes esa carta.';
  const def = CARDS[card];
  if (def.cost > side.energy) return 'No tienes energía suficiente.';
  if (def.target === 'none') return null;
  if (!target || !cardTargets(state, index).includes(target)) return 'Objetivo no válido.';
  return null;
}

// ---------- setup ----------

export interface MatchSetup {
  map: MapDef;
  playerDeck: CardId[];
  aiDeck: CardId[];
  seed: number;
}

function emptySide(deck: CardId[]): SideState {
  return { energy: START_ENERGY, pool: 0, hand: [], deck, discard: [] };
}

export function createMatch({ map, playerDeck, aiDeck, seed }: MatchSetup): MatchState {
  const parsed = parseMap(map);
  const state: MatchState = {
    mapId: map.id,
    cells: parsed.cells,
    order: parsed.order,
    bases: parsed.bases,
    turn: 'player',
    round: 1,
    maxRounds: map.maxRounds,
    sides: { player: emptySide([]), ai: emptySide([]) },
    aiBonus: map.aiBonus,
    rng: seed | 0,
  };
  state.sides.player.deck = shuffle(state, playerDeck);
  state.sides.ai.deck = shuffle(state, aiDeck);
  for (let i = 0; i < START_HAND; i++) {
    draw(state, 'player');
    draw(state, 'ai');
  }
  startTurn(state, 'player', []);
  return state;
}

function draw(state: MatchState, side: Side) {
  const s = state.sides[side];
  if (s.hand.length >= MAX_HAND) return;
  if (s.deck.length === 0) {
    if (s.discard.length === 0) return;
    s.deck = shuffle(state, s.discard);
    s.discard = [];
  }
  s.hand.push(s.deck.shift()!);
}

/** Troops and energy a side will receive at the start of its turn. */
export function incomeOf(state: MatchState, side: Side) {
  const owned = cellsOf(state, side);
  let troops = 2 + Math.floor(owned.length / 4) + (side === 'ai' ? state.aiBonus : 0);
  let energy = ENERGY_PER_TURN;
  for (const c of owned) {
    if (c.building === 'village') troops += 1;
    if (c.building === 'mine') energy += 1 + (hasSynergy(state, c.id, 'vein') ? 1 : 0);
  }
  return { troops, energy };
}

function startTurn(state: MatchState, side: Side, events: GameEvent[]) {
  state.turn = side;
  const s = state.sides[side];
  const income = incomeOf(state, side);
  for (const c of cellsOf(state, side)) {
    c.acted = false;
    c.shielded = false;
    if (c.building === 'base') c.troops += 1;
    if (c.building === 'barracks') {
      const bonus = 1 + (hasSynergy(state, c.id, 'camp') ? 1 : 0) + (hasSynergy(state, c.id, 'forge') ? 1 : 0);
      c.troops += bonus;
    }
  }
  s.pool += income.troops;
  s.energy = Math.min(MAX_ENERGY, s.energy + (state.round === 1 && side === 'player' ? 0 : income.energy));
  if (!(state.round === 1 && side === 'player')) draw(state, side);
  events.push({
    type: 'income',
    side,
    troops: income.troops,
    energy: income.energy,
  });
}

// ---------- actions ----------

const clone = (s: MatchState): MatchState => JSON.parse(JSON.stringify(s));

export function applyAction(prev: MatchState, action: Action): ActionResult {
  const state = clone(prev);
  const events: GameEvent[] = [];
  const fail = (error: string): ActionResult => ({
    state: prev,
    events: [],
    error,
  });
  if (state.winner) return fail('La partida ha terminado.');
  const side = state.turn;
  const me = state.sides[side];

  switch (action.type) {
    case 'place': {
      const c = state.cells[action.cell];
      const n = Math.min(action.amount ?? 1, me.pool);
      if (!c || c.owner !== side) return fail('Solo puedes colocar tropas en tus casillas.');
      if (n <= 0) return fail('No te quedan tropas por colocar.');
      c.troops += n;
      me.pool -= n;
      events.push({ type: 'place', side, cell: c.id, amount: n });
      break;
    }

    case 'move': {
      const err = canMove(state, action.from, action.to);
      if (err) return fail(err);
      const a = state.cells[action.from];
      const b = state.cells[action.to];
      const moving = a.troops - 1;
      a.troops = 1;
      a.acted = true;
      if (b.owner === side) {
        b.troops += moving;
        b.acted = true;
        events.push({
          type: 'move',
          side,
          from: a.id,
          to: b.id,
          amount: moving,
        });
      } else {
        const bonus = defenseBonus(state, b.id);
        const defense = b.troops + bonus;
        const captured = moving > defense;
        if (captured) {
          b.owner = side;
          b.troops = moving - defense;
          b.acted = true;
          b.shielded = false;
        } else {
          b.troops = Math.max(0, b.troops - Math.max(0, moving - bonus));
        }
        events.push({
          type: 'battle',
          side,
          from: a.id,
          to: b.id,
          attack: moving,
          defense,
          captured,
        });
        if (captured && b.building === 'base') {
          state.winner = side;
          events.push({ type: 'win', side });
        }
      }
      break;
    }

    case 'card': {
      const err = canPlayCard(state, action.index, action.target);
      if (err) return fail(err);
      const card = me.hand[action.index];
      const def = CARDS[card];
      me.energy -= def.cost;
      me.hand.splice(action.index, 1);
      me.discard.push(card);
      const t = action.target ? state.cells[action.target] : undefined;
      if (def.builds && t) {
        t.building = def.builds;
        events.push({ type: 'build', side, cell: t.id, building: def.builds });
      } else {
        switch (card) {
          case 'reinforce':
            t!.troops += 3;
            break;
          case 'fireball':
            t!.troops = Math.max(0, t!.troops - 4);
            break;
          case 'shield':
            t!.shielded = true;
            break;
          case 'rally':
            for (const c of cellsOf(state, side)) c.acted = false;
            break;
          case 'quake':
            t!.building = undefined;
            break;
        }
        events.push({ type: 'spell', side, card, cell: t?.id });
      }
      break;
    }

    case 'end': {
      if (me.pool > 0) {
        const base = state.cells[state.bases[side]];
        base.troops += me.pool;
        events.push({ type: 'place', side, cell: base.id, amount: me.pool });
        me.pool = 0;
      }
      towersFire(state, side, events);
      const next = other(side);
      if (side === 'ai') state.round += 1;
      if (state.round > state.maxRounds) {
        const mine = cellsOf(state, 'player').length;
        const theirs = cellsOf(state, 'ai').length;
        state.winner = mine === theirs ? 'draw' : mine > theirs ? 'player' : 'ai';
        events.push({ type: 'win', side: state.winner });
        break;
      }
      startTurn(state, next, events);
      break;
    }
  }
  return { state, events };
}

function towersFire(state: MatchState, side: Side, events: GameEvent[]) {
  const foe = other(side);
  for (const c of cellsOf(state, side)) {
    if (c.building === 'archer') {
      const dmg = 1 + (hasSynergy(state, c.id, 'fort') ? 1 : 0);
      for (const n of neighbors(state, c.id)) {
        if (n.owner === foe && n.troops > 0) {
          const d = Math.min(dmg, n.troops);
          n.troops -= d;
          events.push({
            type: 'shot',
            side,
            from: c.id,
            to: n.id,
            damage: d,
            kind: 'arrow',
          });
        }
      }
    }
    if (c.building === 'catapult') {
      const dmg = 2 + (hasSynergy(state, c.id, 'artillery') ? 1 : 0);
      const targets = state.order
        .map((id) => state.cells[id])
        .filter((n) => n.owner === foe && n.troops > 0 && distanceById(c.id, n.id) === 2)
        .sort((x, y) => y.troops - x.troops);
      const t = targets[0];
      if (t) {
        const d = Math.min(dmg, t.troops);
        t.troops -= d;
        events.push({
          type: 'shot',
          side,
          from: c.id,
          to: t.id,
          damage: d,
          kind: 'stone',
        });
      }
    }
  }
}

export function buildingAt(state: MatchState, id: string): BuildingKind | undefined {
  return state.cells[id]?.building;
}
