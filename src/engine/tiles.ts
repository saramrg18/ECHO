/**
 * Tile behaviour registry.
 *
 * Every tile kind is described by a behaviour object. The movement system only
 * talks to this registry, so new mechanics (e.g. a future PARADOX mode) can add
 * tile kinds with `registerTile` without touching the core turn logic.
 */
import type { Actor, Direction, Level, PendingEcho, Tile, Vec } from './types';

/** Mutable working copy of the dynamic state while a turn is being resolved. */
export interface TurnDraft {
  player: Vec;
  echoQueue: PendingEcho[];
  toggledGroups: Set<string>;
  collapsed: Set<number>;
}

export interface TileContext {
  readonly level: Level;
  readonly draft: TurnDraft;
  readonly tile: Tile;
  readonly pos: Vec;
  readonly index: number;
  readonly dir: Direction;
  readonly actor: Actor;
}

export interface TileBehavior {
  /** Can the piece enter this tile moving in ctx.dir? Default: true. */
  canEnter?(ctx: TileContext): boolean;
  /** Side effects when the piece enters. Returns effect tags for the UI. */
  onEnter?(ctx: TileContext): string[];
  /** Side effects when the piece leaves. Returns effect tags for the UI. */
  onLeave?(ctx: TileContext): string[];
  /** Entering this tile wins the level. */
  readonly isExit?: boolean;
}

const registry = new Map<string, TileBehavior>();

export function registerTile(kind: string, behavior: TileBehavior): void {
  registry.set(kind, behavior);
}

export function getTileBehavior(kind: string): TileBehavior {
  const b = registry.get(kind);
  if (!b) throw new Error(`Unknown tile kind "${kind}"`);
  return b;
}

/** Door open state = initial state XOR toggled an odd number of times. */
export function isDoorOpen(tile: Tile, toggledGroups: ReadonlySet<string> | readonly string[]): boolean {
  const toggled = Array.isArray(toggledGroups)
    ? (toggledGroups as readonly string[]).includes(tile.group ?? '')
    : (toggledGroups as ReadonlySet<string>).has(tile.group ?? '');
  return Boolean(tile.initiallyOpen) !== toggled;
}

const blocked: TileBehavior = { canEnter: () => false };

registerTile('void', blocked);
registerTile('wall', blocked);
registerTile('floor', {});
registerTile('exit', { isExit: true });

registerTile('switch', {
  onEnter: ({ tile, draft }) => {
    const g = tile.group ?? '';
    if (draft.toggledGroups.has(g)) draft.toggledGroups.delete(g);
    else draft.toggledGroups.add(g);
    return [`toggle:${g}`];
  },
});

registerTile('door', {
  canEnter: ({ tile, draft }) => isDoorOpen(tile, draft.toggledGroups),
});

/** Crumbling floor: collapses into a hole once the piece leaves it. */
registerTile('crumble', {
  canEnter: ({ draft, index }) => !draft.collapsed.has(index),
  onLeave: ({ draft, index }) => {
    draft.collapsed.add(index);
    return ['collapse'];
  },
});

/** One-way tile: can only be entered moving in its arrow direction. */
registerTile('oneway', {
  canEnter: ({ tile, dir }) => tile.dir === dir,
});

/** Silence tile: erases every pending echo. */
registerTile('silence', {
  onEnter: ({ draft }) => {
    if (draft.echoQueue.length === 0) return [];
    draft.echoQueue.length = 0;
    return ['silence'];
  },
});
