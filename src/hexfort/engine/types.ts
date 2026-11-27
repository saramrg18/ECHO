export type Side = 'player' | 'ai';
export type Owner = Side | 'neutral';
export type Terrain = 'plain' | 'forest' | 'hill' | 'water';
export type BuildingKind = 'base' | 'village' | 'guard' | 'archer' | 'barracks' | 'mine' | 'catapult';

export type CardId =
  | 'guard'
  | 'archer'
  | 'barracks'
  | 'mine'
  | 'catapult'
  | 'reinforce'
  | 'fireball'
  | 'shield'
  | 'rally'
  | 'quake';

export interface Cell {
  id: string;
  q: number;
  r: number;
  terrain: Terrain;
  owner: Owner;
  troops: number;
  building?: BuildingKind;
  /** Already moved (or received troops) this turn. */
  acted: boolean;
  /** Protected from attacks until its owner's next turn. */
  shielded: boolean;
}

export interface SideState {
  energy: number;
  /** Troops waiting to be placed this turn. */
  pool: number;
  hand: CardId[];
  deck: CardId[];
  discard: CardId[];
}

export type GameEvent =
  | { type: 'move'; side: Side; from: string; to: string; amount: number }
  | {
      type: 'battle';
      side: Side;
      from: string;
      to: string;
      attack: number;
      defense: number;
      captured: boolean;
    }
  | { type: 'place'; side: Side; cell: string; amount: number }
  | { type: 'build'; side: Side; cell: string; building: BuildingKind }
  | { type: 'spell'; side: Side; card: CardId; cell?: string }
  | {
      type: 'shot';
      side: Side;
      from: string;
      to: string;
      damage: number;
      kind: 'arrow' | 'stone';
    }
  | { type: 'income'; side: Side; troops: number; energy: number }
  | { type: 'win'; side: Side | 'draw' };

export interface MatchState {
  mapId: string;
  cells: Record<string, Cell>;
  /** Cell ids in a stable order (row by row). */
  order: string[];
  bases: Record<Side, string>;
  turn: Side;
  round: number;
  maxRounds: number;
  sides: Record<Side, SideState>;
  /** Extra troops the AI receives each turn (difficulty). */
  aiBonus: number;
  rng: number;
  winner?: Side | 'draw';
}

export type Action =
  | { type: 'place'; cell: string; amount?: number }
  | { type: 'move'; from: string; to: string }
  | { type: 'card'; index: number; target?: string }
  | { type: 'end' };

export interface ActionResult {
  state: MatchState;
  events: GameEvent[];
  error?: string;
}
