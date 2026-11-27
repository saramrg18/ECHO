/** Player assistance built on the engine: move preview and hints. */
import { applyMove } from './game';
import { solve } from './solver';
import type { Direction, GameState, GameStatus, StepEvent, Vec } from './types';

export interface MovePreview {
  readonly steps: readonly StepEvent[];
  /** Where the piece ends after the player's move and any echoes. */
  readonly final: Vec;
  readonly status: GameStatus;
}

/** What would happen if the player moved in `dir` now, or null if the move is not allowed. */
export function previewMove(state: GameState, dir: Direction): MovePreview | null {
  const r = applyMove(state, dir);
  if (!r.accepted) return null;
  return { steps: r.state.lastSteps, final: r.state.player, status: r.state.status };
}

export type Hint = { readonly kind: 'move'; readonly dir: Direction } | { readonly kind: 'stuck' };

/** First move of an optimal solution from the current state; 'stuck' when the level can no longer be won. */
export function nextHint(state: GameState): Hint {
  if (state.status !== 'playing') return { kind: 'stuck' };
  const { solution } = solve(state.level, { from: state, maxStates: 300_000 });
  return solution && solution.length > 0 ? { kind: 'move', dir: solution[0] } : { kind: 'stuck' };
}
