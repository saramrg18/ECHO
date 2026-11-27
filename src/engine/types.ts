/**
 * Core data structures of the ECHO engine.
 * This module is pure TypeScript: no React / React Native imports allowed here.
 */

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface Vec {
  readonly x: number;
  readonly y: number;
}

/** Built-in tile kinds. New mechanics register new kinds in the tile registry. */
export type TileKind =
  | 'void'
  | 'floor'
  | 'wall'
  | 'exit'
  | 'switch'
  | 'door'
  | 'crumble'
  | 'oneway'
  | 'silence'
  | (string & {});

export interface Tile {
  readonly kind: TileKind;
  /** Switch/door group (e.g. "a"). A switch toggles every door of its group. */
  readonly group?: string;
  /** Doors only: whether the door starts open. */
  readonly initiallyOpen?: boolean;
  /** One-way tiles only: the only direction in which the tile can be entered. */
  readonly dir?: Direction;
}

export interface Board {
  readonly width: number;
  readonly height: number;
  /** Row-major: index = y * width + x */
  readonly tiles: readonly Tile[];
}

/** Level as authored in data files. */
export interface LevelDefinition {
  readonly id: string;
  readonly name: string;
  /** ASCII map, see level-parser.ts for the legend. */
  readonly map: readonly string[];
  /** Turns until a move is repeated. Default 3. */
  readonly echoDelay?: number;
  /** Optional move limit. When reached without winning, the level is lost. */
  readonly maxMoves?: number;
  /** Short tutorial text shown with the level. */
  readonly hint?: string;
}

/** Parsed, immutable level. */
export interface Level {
  readonly id: string;
  readonly name: string;
  readonly board: Board;
  readonly start: Vec;
  readonly echoDelay: number;
  readonly maxMoves?: number;
  readonly hint?: string;
}

/** A move waiting in the repetition queue. */
export interface PendingEcho {
  readonly dir: Direction;
  /** Turn (1-based) on which the move was originally made. */
  readonly sourceTurn: number;
  /** Turn on which the echo will execute (sourceTurn + echoDelay). */
  readonly executesOnTurn: number;
}

export type Actor = 'player' | 'echo';

/** One resolved step inside a turn, used by the UI to animate. */
export interface StepEvent {
  readonly actor: Actor;
  readonly dir: Direction;
  readonly from: Vec;
  readonly to: Vec;
  /** True when the step hit an obstacle and did not happen. */
  readonly blocked: boolean;
  /** Tile-level effects triggered by this step (e.g. "toggle:a", "silence", "collapse"). */
  readonly effects: readonly string[];
  /** For echoes: the turn the repeated move was originally made on. */
  readonly sourceTurn?: number;
}

export type GameStatus = 'playing' | 'won' | 'lost';

export interface GameState {
  readonly level: Level;
  readonly player: Vec;
  /** Number of turns played so far (= moves used). */
  readonly turn: number;
  readonly echoQueue: readonly PendingEcho[];
  /** Groups whose doors have been toggled an odd number of times. */
  readonly toggledGroups: readonly string[];
  /** Cell indices of crumble tiles that have collapsed. Sorted. */
  readonly collapsed: readonly number[];
  readonly status: GameStatus;
  /** Steps resolved during the last turn (empty at start). */
  readonly lastSteps: readonly StepEvent[];
}

export type MoveResult =
  | { readonly accepted: true; readonly state: GameState }
  | { readonly accepted: false; readonly state: GameState; readonly reason: 'blocked' | 'finished' };
