/**
 * Repetition system: every move is recorded and replayed `echoDelay` turns later.
 *
 * Turn t: the player's move is recorded with executesOnTurn = t + delay, then the
 * player's step is resolved, then every echo due on turn t is replayed in the
 * order the original moves were made.
 */
import type { Direction, GameState, PendingEcho } from './types';

export function recordMove(queue: PendingEcho[], dir: Direction, turn: number, delay: number): void {
  queue.push({ dir, sourceTurn: turn, executesOnTurn: turn + delay });
}

/** Removes and returns the echoes due on `turn`, oldest first. */
export function takeDue(queue: PendingEcho[], turn: number): PendingEcho[] {
  const due: PendingEcho[] = [];
  for (let i = 0; i < queue.length; ) {
    if (queue[i].executesOnTurn <= turn) due.push(...queue.splice(i, 1));
    else i++;
  }
  return due.sort((a, b) => a.sourceTurn - b.sourceTurn);
}

export interface UpcomingEcho extends PendingEcho {
  /** 1 = will execute on the next turn. */
  readonly turnsUntil: number;
}

/** The echoes that will repeat in the coming turns, soonest first. */
export function upcomingEchoes(state: GameState): UpcomingEcho[] {
  return [...state.echoQueue]
    .sort((a, b) => a.executesOnTurn - b.executesOnTurn || a.sourceTurn - b.sourceTurn)
    .map((e) => ({ ...e, turnsUntil: e.executesOnTurn - state.turn }));
}
