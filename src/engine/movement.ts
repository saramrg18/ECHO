/**
 * Movement system: resolves a single step of the piece (by the player or by an echo).
 */
import { indexOf, tileAt } from './board';
import { translate } from './directions';
import { getTileBehavior, type TileContext, type TurnDraft } from './tiles';
import type { Actor, Direction, Level, StepEvent, Vec } from './types';

export interface StepOutcome {
  readonly event: StepEvent;
  readonly reachedExit: boolean;
}

function context(level: Level, draft: TurnDraft, pos: Vec, dir: Direction, actor: Actor): TileContext {
  return {
    level,
    draft,
    pos,
    dir,
    actor,
    tile: tileAt(level.board, pos),
    index: indexOf(level.board, pos),
  };
}

/** Can the piece at `from` move in `dir` given the current draft? Pure check. */
export function canStep(level: Level, draft: TurnDraft, dir: Direction): boolean {
  const to = translate(draft.player, dir);
  const ctx = context(level, draft, to, dir, 'player');
  const b = getTileBehavior(ctx.tile.kind);
  return b.canEnter ? b.canEnter(ctx) : true;
}

/** Performs one step, mutating the draft. Blocked steps leave the draft unchanged. */
export function step(
  level: Level,
  draft: TurnDraft,
  dir: Direction,
  actor: Actor,
  sourceTurn?: number,
): StepOutcome {
  const from = draft.player;
  const to = translate(from, dir);
  const enterCtx = context(level, draft, to, dir, actor);
  const enterBehavior = getTileBehavior(enterCtx.tile.kind);

  if (enterBehavior.canEnter && !enterBehavior.canEnter(enterCtx)) {
    return {
      event: { actor, dir, from, to: from, blocked: true, effects: [], sourceTurn },
      reachedExit: false,
    };
  }

  const effects: string[] = [];
  const leaveCtx = context(level, draft, from, dir, actor);
  const leaveBehavior = getTileBehavior(leaveCtx.tile.kind);
  if (leaveBehavior.onLeave) effects.push(...leaveBehavior.onLeave(leaveCtx));

  draft.player = to;
  if (enterBehavior.onEnter) effects.push(...enterBehavior.onEnter(enterCtx));

  return {
    event: { actor, dir, from, to, blocked: false, effects, sourceTurn },
    reachedExit: Boolean(enterBehavior.isExit),
  };
}
