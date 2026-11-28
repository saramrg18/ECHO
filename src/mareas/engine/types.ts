/** Core types for MAREAS, a tide-driven real-time duel between two islands. */

export type Side = 'player' | 'ai';
export type Tide = 'low' | 'high';
export type CardKind = 'creature' | 'boat' | 'build' | 'spell';

export type CardId =
  | 'cangrejos'
  | 'tortuga'
  | 'morsa'
  | 'bote'
  | 'balandro'
  | 'puente'
  | 'dique'
  | 'ola'
  | 'pezglobo'
  | 'erizos'
  | 'galeon'
  | 'mareaviva';

export type SeaId = 'laguna' | 'arrecife' | 'manglar' | 'hielo' | 'volcan' | 'abismo';

export interface UnitStats {
  hp: number;
  /** Damage per hit. */
  dmg: number;
  /** Seconds between hits. */
  interval: number;
  /** Reach, in world units. */
  range: number;
  /** World units per second. */
  speed: number;
  /** Swims: never drowns (creatures only). */
  amphibious?: boolean;
  /** Explodes on its first hit, damaging everything close by. */
  explode?: { dmg: number; radius: number };
  /** How many figures one card spawns. */
  count?: number;
}

export interface CardDef {
  id: CardId;
  name: string;
  kind: CardKind;
  cost: number;
  icon: string;
  /** One short sentence in plain Spanish. */
  text: string;
  /** Does the card need a target island? (Marea viva does not.) */
  needsTarget: boolean;
  unit?: UnitStats;
  sea: SeaId;
}

export type UnitState = 'wait' | 'move' | 'fight' | 'stranded' | 'drowning' | 'capture' | 'guard';

export type IslandKind = 'home' | 'energy' | 'fort';

export interface Island {
  id: number;
  name: string;
  kind: IslandKind;
  x: number;
  z: number;
  /** Radius of dry land. */
  r: number;
  /** Home islands belong to a side from the start. */
  home?: Side;
}

/** A sandbar between two islands. */
export interface Bar {
  id: number;
  a: number;
  b: number;
}

export interface MapDef {
  islands: Island[];
  bars: Bar[];
}

export interface IslandState {
  owner: Side | null;
  /** Capture progress, -1..1 (negative = AI). */
  capture: number;
  /** Fort islands: seconds until the next shot. */
  cooldown: number;
}

export interface Unit {
  id: number;
  side: Side;
  card: CardId;
  kind: 'creature' | 'boat';
  x: number;
  z: number;
  /** Island it is on or last left. */
  node: number;
  /** Bar it is walking: the next island and progress 0..1 (creatures only). */
  next: number | null;
  t: number;
  /** Island it was sent to. */
  goal: number;
  /** Small offset so a group does not stack. */
  ox: number;
  oz: number;
  hp: number;
  maxHp: number;
  dmg: number;
  interval: number;
  cooldown: number;
  /** Reach, in world units. */
  range: number;
  /** World units per second. */
  speed: number;
  amphibious: boolean;
  explode?: { dmg: number; radius: number };
  state: UnitState;
  /** Seconds since last hit taken, for the flash. */
  hurt: number;
}

export type StructureKind = 'bridge' | 'wall' | 'trap';

export interface Structure {
  id: number;
  side: Side;
  card: CardId;
  kind: StructureKind;
  /** Island it stands on (a bridge covers every sandbar touching it). */
  island: number;
  x: number;
  z: number;
  hp: number;
  maxHp: number;
  ttl: number;
  maxTtl: number;
}

export type MatchEvent =
  | { type: 'hit'; x: number; z: number; side: Side }
  | { type: 'beam'; side: Side; fromX: number; fromZ: number; x: number; z: number; tall: boolean }
  | { type: 'death'; x: number; z: number; kind: 'creature' | 'boat' | 'wall'; drowned: boolean }
  | { type: 'boom'; x: number; z: number }
  | { type: 'wave'; x: number; z: number; side: Side }
  | { type: 'tide'; tide: Tide }
  | { type: 'play'; side: Side; card: CardId; island: number | null }
  | { type: 'capture'; island: number; side: Side }
  | { type: 'lighthouse'; side: Side };

export interface SidePlayer {
  energy: number;
  hand: CardId[];
  queue: CardId[];
  levels: Partial<Record<CardId, number>>;
  lighthouse: number;
  lighthouseMax: number;
  beamCooldown: number;
  /** Energy speed multiplier (the easiest rivals charge slower). */
  energyRate: number;
}

export type Result = 'win' | 'lose' | 'draw';

export interface MatchConfig {
  sea: SeaId;
  playerDeck: CardId[];
  aiDeck: CardId[];
  playerLevels?: Partial<Record<CardId, number>>;
  aiLevels?: Partial<Record<CardId, number>>;
  seed?: number;
  /** Guided first match: fixed hand, softer rival. */
  tutorial?: boolean;
  duration?: number;
  /** Rival energy speed multiplier, 1 by default. */
  aiEnergyRate?: number;
}

export interface MatchState {
  sea: SeaId;
  time: number;
  duration: number;
  tide: Tide;
  /** Seconds until the tide changes. */
  tideLeft: number;
  /** 0 = sand fully dry, 1 = sand fully covered (animated). */
  water: number;
  paused: boolean;
  /** The AI does nothing while false (used by the guided match). */
  aiActive: boolean;
  players: Record<Side, SidePlayer>;
  map: MapDef;
  islands: IslandState[];
  /** Sandbars uncovered at this (or the next) low tide. */
  openBars: number[];
  units: Unit[];
  structures: Structure[];
  events: MatchEvent[];
  result: Result | null;
  nextId: number;
  seed: number;
  tutorial: boolean;
  /** Stats for the end screen. */
  stats: { drowned: Record<Side, number>; stranded: Record<Side, number> };
}
