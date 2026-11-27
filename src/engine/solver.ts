/**
 * Breadth-first solver. Used by tests to prove every level is solvable and to
 * compute the optimal number of moves (par), and available for hints.
 */
import { DIRECTIONS } from './directions';
import { applyMove, createInitialState } from './game';
import type { Direction, GameState, Level } from './types';

export function stateKey(s: GameState): string {
  const q = s.echoQueue.map((e) => `${e.dir[0]}${e.executesOnTurn - s.turn}`).join('');
  return `${s.player.x},${s.player.y}|${q}|${s.toggledGroups.join('')}|${s.collapsed.join(',')}`;
}

export interface SolveResult {
  readonly solution: Direction[] | null;
  readonly explored: number;
}

export function solve(level: Level, opts: { maxStates?: number; from?: GameState } = {}): SolveResult {
  const maxStates = opts.maxStates ?? 2_000_000;
  const start = opts.from ?? createInitialState(level);
  if (start.status === 'won') return { solution: [], explored: 1 };

  const seen = new Set<string>([stateKey(start)]);
  let frontier: { state: GameState; path: Direction[] }[] = [{ state: start, path: [] }];

  while (frontier.length > 0) {
    const next: typeof frontier = [];
    for (const { state, path } of frontier) {
      for (const dir of DIRECTIONS) {
        const r = applyMove(state, dir);
        if (!r.accepted) continue;
        const p = [...path, dir];
        if (r.state.status === 'won') return { solution: p, explored: seen.size };
        if (r.state.status === 'lost') continue;
        const k = stateKey(r.state);
        if (seen.has(k)) continue;
        seen.add(k);
        if (seen.size > maxStates) return { solution: null, explored: seen.size };
        next.push({ state: r.state, path: p });
      }
    }
    frontier = next;
  }
  return { solution: null, explored: seen.size };
}

/** Plays a sequence of moves from the start. Throws if a move is rejected. */
export function playMoves(level: Level, moves: readonly Direction[]): GameState {
  let s = createInitialState(level);
  for (const m of moves) {
    const r = applyMove(s, m);
    if (!r.accepted) throw new Error(`Move ${m} rejected at turn ${s.turn + 1}`);
    s = r.state;
  }
  return s;
}
