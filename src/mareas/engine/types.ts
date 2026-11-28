/** Core types for MAREAS, a tide-driven real-time duel between two islands. */

export type Side = 'player' | 'ai';
export type Lane = 0 | 1 | 2;
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
  /** Reach along the lane, as a fraction of the lane (0..1). */
  range: number;
  /** Lane fraction per second. */
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
  /** Does the card need a lane? (Marea viva does not.) */
  needsLane: boolean;
  unit?: UnitStats;
  sea: SeaId;
}

export type UnitState = 'wait' | 'move' | 'fight' | 'stranded' | 'drowning';

export interface Unit {
  id: number;
  side: Side;
  card: CardId;
  kind: 'creature' | 'boat';
  lane: Lane;
  /** Position along the lane: 0 = player's beach, 1 = AI's beach. */
  d: number;
  /** Small sideways offset so a group does not stack. */
  x: number;
  hp: number;
  maxHp: number;
  dmg: number;
  interval: number;
  cooldown: number;
  range: number;
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
  lane: Lane;
  d: number;
  hp: number;
  maxHp: number;
  /** Seconds left before it disappears. */
  ttl: number;
  maxTtl: number;
}

export type MatchEvent =
  | { type: 'hit'; lane: Lane; d: number; side: Side }
  | { type: 'beam'; side: Side; lane: Lane; d: number }
  | { type: 'death'; lane: Lane; d: number; kind: 'creature' | 'boat' | 'wall'; drowned: boolean }
  | { type: 'boom'; lane: Lane; d: number }
  | { type: 'wave'; lane: Lane; side: Side }
  | { type: 'tide'; tide: Tide }
  | { type: 'play'; side: Side; card: CardId; lane: Lane | null }
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
