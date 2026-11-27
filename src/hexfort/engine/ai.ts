/**
 * Simple greedy AI. It plans a full turn on a copy of the state and returns the list of
 * actions, so the UI can replay them one by one with animations.
 */
import { CARDS } from './cards';
import { distanceById } from './hex';
import { applyAction, canMove, cardTargets, cellsOf, defenseOf, neighbors, other } from './rules';
import type { Action, Cell, MatchState, Side } from './types';

const MAX_STEPS = 80;

/** How much enemy force could hit this cell next turn, minus what defends it. */
function threat(state: MatchState, cell: Cell): number {
  const foe = other(cell.owner as Side);
  const incoming = neighbors(state, cell.id)
    .filter((n) => n.owner === foe)
    .reduce((s, n) => s + Math.max(0, n.troops - 1), 0);
  return incoming - defenseOf(state, cell.id);
}

const isFrontier = (state: MatchState, c: Cell) => neighbors(state, c.id).some((n) => n.owner !== c.owner);

function enemiesNear(state: MatchState, c: Cell, side: Side) {
  return neighbors(state, c.id).filter((n) => n.owner === other(side));
}

function scoreBuildTarget(state: MatchState, side: Side, card: string, c: Cell): number {
  const foeBase = state.bases[other(side)];
  const dist = distanceById(c.id, foeBase);
  const ownNear = neighbors(state, c.id).filter((n) => n.owner === side && n.building);
  const partner = (kind: string) => (ownNear.some((n) => n.building === kind) ? 3 : 0);
  const frontier = isFrontier(state, c);
  switch (card) {
    case 'archer': {
      const e = enemiesNear(state, c, side).length;
      return e === 0 ? -1 : e * 3 + partner('guard');
    }
    case 'guard': {
      const t = threat(state, c);
      return (frontier ? 4 : 0) + Math.max(0, t + 3) + (c.id === state.bases[side] ? 0 : 0) + partner('guard');
    }
    case 'barracks':
      return (frontier ? 1 : 4) + Math.max(0, 8 - dist) * 0.5 + partner('barracks') + partner('mine');
    case 'mine':
      return frontier ? 0.5 : 4 + dist * 0.3 + partner('mine') + partner('barracks');
    case 'catapult': {
      const far = state.order.filter(
        (id) => state.cells[id].owner === other(side) && distanceById(c.id, id) === 2,
      ).length;
      return far === 0 ? -1 : far * 2 + partner('archer');
    }
  }
  return 0;
}

function bestCardPlay(state: MatchState): Action | null {
  const side = state.turn;
  const me = state.sides[side];
  let best: { action: Action; score: number } | null = null;
  const consider = (action: Action, score: number) => {
    if (score > 0 && (!best || score > best.score)) best = { action, score };
  };

  me.hand.forEach((card, index) => {
    const def = CARDS[card];
    if (def.cost > me.energy) return;
    const targets = cardTargets(state, index).map((id) => state.cells[id]);
    if (def.kind === 'tower') {
      for (const t of targets)
        consider({ type: 'card', index, target: t.id }, scoreBuildTarget(state, side, card, t) + def.cost * 0.2);
      return;
    }
    switch (card) {
      case 'reinforce':
        for (const t of targets) {
          const opp = Math.max(0, ...enemiesNear(state, t, side).map((e) => (e.building ? 4 : 1)));
          consider({ type: 'card', index, target: t.id }, Math.max(0, threat(state, t) + 3) + opp);
        }
        break;
      case 'fireball':
        for (const t of targets) {
          const adj = neighbors(state, t.id).some((n) => n.owner === side && n.troops > 1);
          const isBase = t.id === state.bases[other(side)];
          consider(
            { type: 'card', index, target: t.id },
            (t.troops >= 3 ? t.troops : 0) + (adj ? 2 : 0) + (isBase && adj ? 6 : 0),
          );
        }
        break;
      case 'shield': {
        const base = state.cells[state.bases[side]];
        consider({ type: 'card', index, target: base.id }, threat(state, base) > -2 ? 9 : 0);
        break;
      }
      case 'quake':
        for (const t of targets)
          consider({ type: 'card', index, target: t.id }, t.building === 'archer' || t.building === 'catapult' ? 6 : 4);
        break;
      case 'rally': {
        const ready = cellsOf(state, side).filter((c) => c.acted && c.troops >= 3).length;
        consider({ type: 'card', index }, ready >= 2 ? ready * 2 : 0);
        break;
      }
    }
  });
  return best ? (best as { action: Action }).action : null;
}

function bestPlacement(state: MatchState): Action | null {
  const side = state.turn;
  const pool = state.sides[side].pool;
  if (pool <= 0) return null;
  const foeBase = state.bases[other(side)];
  let best: Cell | null = null;
  let bestScore = -Infinity;
  for (const c of cellsOf(state, side)) {
    const near = neighbors(state, c.id).filter((n) => n.owner !== side);
    if (near.length === 0) continue;
    const t = threat(state, c);
    const weakest = Math.min(...near.map((n) => defenseOf(state, n.id)));
    const score = (t > 0 ? t * 1.5 : 0) + 6 - weakest + (8 - distanceById(c.id, foeBase)) * 0.6 + c.troops * 0.2;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  const target = best ?? state.cells[state.bases[side]];
  return { type: 'place', cell: target.id, amount: pool };
}

function bestMove(state: MatchState): Action | null {
  const side = state.turn;
  const foeBase = state.bases[other(side)];
  let best: { action: Action; score: number } | null = null;
  for (const a of cellsOf(state, side)) {
    if (a.acted || a.troops < 2) continue;
    const moving = a.troops - 1;
    const isOwnBase = a.id === state.bases[side];
    for (const b of neighbors(state, a.id)) {
      if (canMove(state, a.id, b.id)) continue;
      let score = -Infinity;
      if (b.owner === side) {
        // Consolidate interior troops towards the front.
        if (isFrontier(state, a) || moving < 2) continue;
        if (isOwnBase && moving < 4) continue;
        const gain = distanceById(a.id, foeBase) - distanceById(b.id, foeBase);
        score = gain > 0 ? 1 + gain : isFrontier(state, b) ? 0.5 : -1;
      } else {
        const def = defenseOf(state, b.id);
        if (moving <= def) continue;
        score = 10 - def * 0.4 + (b.owner === other(side) ? 6 : 0) + (b.building ? 5 : 0);
        if (b.id === foeBase) score += 1000;
        // Leaving the own base exposed is risky.
        if (isOwnBase) {
          const after = { ...state.cells[a.id], troops: 1 };
          if (threat({ ...state, cells: { ...state.cells, [a.id]: after } }, after) > 0) score -= 12;
        }
      }
      if (!best || score > best.score) best = { action: { type: 'move', from: a.id, to: b.id }, score };
    }
  }
  return best && best.score > 0 ? best.action : null;
}

export function planAiTurn(initial: MatchState): Action[] {
  const actions: Action[] = [];
  let state = initial;
  const run = (a: Action | null) => {
    if (!a) return false;
    const res = applyAction(state, a);
    if (res.error) return false;
    actions.push(a);
    state = res.state;
    return true;
  };

  while (actions.length < MAX_STEPS && !state.winner && run(bestCardPlay(state)));
  run(bestPlacement(state));
  while (actions.length < MAX_STEPS && !state.winner) {
    if (run(bestMove(state))) continue;
    // A second card wave (e.g. Grito de guerra) can unlock more moves.
    if (run(bestCardPlay(state))) continue;
    break;
  }
  if (!state.winner) actions.push({ type: 'end' });
  return actions;
}
