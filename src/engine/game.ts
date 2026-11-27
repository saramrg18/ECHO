/**
 * Game state: pure, immutable turn reducer plus a small session wrapper
 * providing undo and restart.
 */
import { recordMove, takeDue } from './echo-queue';
import { canStep, step } from './movement';
import type { TurnDraft } from './tiles';
import type { Direction, GameState, Level, MoveResult, StepEvent } from './types';

export function createInitialState(level: Level): GameState {
  return {
    level,
    player: level.start,
    turn: 0,
    echoQueue: [],
    toggledGroups: [],
    collapsed: [],
    status: 'playing',
    lastSteps: [],
  };
}

function toDraft(state: GameState): TurnDraft {
  return {
    player: state.player,
    echoQueue: [...state.echoQueue],
    toggledGroups: new Set(state.toggledGroups),
    collapsed: new Set(state.collapsed),
  };
}

/**
 * Plays one turn. A move into an obstacle is rejected and does not consume a
 * turn; an echo that hits an obstacle is simply skipped.
 */
export function applyMove(state: GameState, dir: Direction): MoveResult {
  if (state.status !== 'playing') return { accepted: false, state, reason: 'finished' };

  const { level } = state;
  const draft = toDraft(state);
  if (!canStep(level, draft, dir)) return { accepted: false, state, reason: 'blocked' };

  const turn = state.turn + 1;
  const steps: StepEvent[] = [];
  recordMove(draft.echoQueue, dir, turn, level.echoDelay);

  let won = false;
  const playerStep = step(level, draft, dir, 'player');
  steps.push(playerStep.event);
  won = playerStep.reachedExit;

  if (!won) {
    for (const echo of takeDue(draft.echoQueue, turn)) {
      const echoStep = step(level, draft, echo.dir, 'echo', echo.sourceTurn);
      steps.push(echoStep.event);
      if (echoStep.reachedExit) {
        won = true;
        break;
      }
    }
  }

  const outOfMoves = level.maxMoves !== undefined && turn >= level.maxMoves;
  const next: GameState = {
    level,
    player: draft.player,
    turn,
    echoQueue: draft.echoQueue,
    toggledGroups: [...draft.toggledGroups].sort(),
    collapsed: [...draft.collapsed].sort((a, b) => a - b),
    status: won ? 'won' : outOfMoves ? 'lost' : 'playing',
    lastSteps: steps,
  };
  return { accepted: true, state: next };
}

/** Remaining moves, or undefined when the level has no limit. */
export function movesLeft(state: GameState): number | undefined {
  return state.level.maxMoves === undefined ? undefined : state.level.maxMoves - state.turn;
}

/** Session = current state + history, supporting undo and restart. */
export interface GameSession {
  readonly current: GameState;
  readonly history: readonly GameState[];
}

export function createSession(level: Level): GameSession {
  return { current: createInitialState(level), history: [] };
}

export function sessionMove(session: GameSession, dir: Direction): { session: GameSession; result: MoveResult } {
  const result = applyMove(session.current, dir);
  if (!result.accepted) return { session, result };
  return { session: { current: result.state, history: [...session.history, session.current] }, result };
}

export function canUndo(session: GameSession): boolean {
  return session.history.length > 0;
}

export function undo(session: GameSession): GameSession {
  if (!canUndo(session)) return session;
  const history = session.history.slice(0, -1);
  return { current: { ...session.history[session.history.length - 1], lastSteps: [] }, history };
}

export function restart(session: GameSession): GameSession {
  return createSession(session.current.level);
}
