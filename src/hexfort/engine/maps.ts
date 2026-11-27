import { hexId } from './hex';
import type { CardId, Cell, Side, Terrain } from './types';

/**
 * Maps are hexagons written row by row (top row = rival side).
 * Row r has 2R+1-|r| cells. Spaces are ignored.
 *   .  llanura        f  bosque (+1 def)   h  colina (+1 def)   ~  agua (no se pasa)
 *   v  aldea neutral (+1 tropa por turno a quien la tenga)
 *   P  tu castillo     A  castillo rival
 *   p  casilla tuya    a  casilla rival
 */
export interface MapDef {
  id: string;
  name: string;
  subtitle: string;
  rows: string[];
  maxRounds: number;
  aiBonus: number;
  /** Cards unlocked the first time you win here. */
  reward: CardId[];
}

export const CAMPAIGN: MapDef[] = [
  {
    id: 'm1',
    name: 'Valle Verde',
    subtitle: 'Aprende a conquistar',
    maxRounds: 20,
    aiBonus: 0,
    reward: ['fireball', 'fireball'],
    rows: ['. . . .', '. . A . .', '. f a f . .', '. . . v . . .', '. . f p f .', '. . P . .', '. . . .'],
  },
  {
    id: 'm2',
    name: 'Río Partido',
    subtitle: 'Cruza por los puentes',
    maxRounds: 22,
    aiBonus: 0,
    reward: ['shield', 'shield'],
    rows: [
      '. h . . h',
      '. . . A . .',
      '. f . a . f .',
      '~ ~ . ~ ~ . ~ ~',
      '. v . . . . . v .',
      '~ ~ . ~ ~ . ~ ~',
      '. f . p . f .',
      '. . . P . .',
      'h . . . h',
    ],
  },
  {
    id: 'm3',
    name: 'Colinas Rotas',
    subtitle: 'El rival se defiende mejor',
    maxRounds: 24,
    aiBonus: 1,
    reward: ['catapult', 'catapult'],
    rows: [
      '. . h . .',
      '. h . A . h',
      '. . . a a . .',
      'f . h . . h . f',
      '. v . . ~ . . v .',
      'f . h . . h . f',
      '. . p p . . .',
      'h . P . h .',
      '. . h . .',
    ],
  },
  {
    id: 'm4',
    name: 'Bosque Hondo',
    subtitle: 'Aldeas escondidas',
    maxRounds: 24,
    aiBonus: 1,
    reward: ['rally', 'rally'],
    rows: [
      'f f . f f',
      'f . . A . f',
      '. v f a f v .',
      'f . . f f . . f',
      '. f . . v . . f .',
      'f . . f f . . f',
      '. v f p f v .',
      'f . . P . f',
      'f f . f f',
    ],
  },
  {
    id: 'm5',
    name: 'Corona de Hierro',
    subtitle: 'La batalla final',
    maxRounds: 26,
    aiBonus: 2,
    reward: ['quake', 'quake'],
    rows: [
      'h . ~ ~ . h',
      '. . . . . . .',
      '. f . . A . f .',
      '. v . . a a . v .',
      '~ . . h . . . h . ~',
      '. . f . . v . . f . .',
      '~ . h . . . h . . ~',
      '. v . . p p . v .',
      '. f . . P . f .',
      '. . . . . . .',
      'h . ~ ~ . h',
    ],
  },
];

export const SKIRMISH: MapDef = {
  id: 'skirmish',
  name: 'Escaramuza',
  subtitle: 'Partida rápida',
  maxRounds: 22,
  aiBonus: 1,
  reward: [],
  rows: [
    '. h . . h',
    '. . f A f .',
    '. v . a . v .',
    '. . . h h . . .',
    'f . ~ . v . ~ . f',
    '. . . h h . . .',
    '. v . p . v .',
    '. . f P f .',
    '. h . . h',
  ],
};

export const ALL_MAPS: MapDef[] = [...CAMPAIGN, SKIRMISH];

export function findMap(id: string): MapDef | undefined {
  return ALL_MAPS.find((m) => m.id === id);
}

const NEUTRAL_TROOPS: Record<Terrain, number> = {
  plain: 1,
  forest: 2,
  hill: 2,
  water: 0,
};

export interface ParsedMap {
  cells: Record<string, Cell>;
  order: string[];
  bases: Record<Side, string>;
}

export function parseMap(def: MapDef): ParsedMap {
  const R = (def.rows.length - 1) / 2;
  if (!Number.isInteger(R) || R < 1) throw new Error(`${def.id}: needs an odd number of rows`);
  const cells: Record<string, Cell> = {};
  const order: string[] = [];
  const bases: Partial<Record<Side, string>> = {};

  def.rows.forEach((row, i) => {
    const r = i - R;
    const chars = row.replace(/\s+/g, '').split('');
    const qMin = Math.max(-R, -r - R);
    const expected = 2 * R + 1 - Math.abs(r);
    if (chars.length !== expected) {
      throw new Error(`${def.id}: row ${i} has ${chars.length} cells, expected ${expected}`);
    }
    chars.forEach((ch, j) => {
      const q = qMin + j;
      const id = hexId(q, r);
      const cell: Cell = {
        id,
        q,
        r,
        terrain: 'plain',
        owner: 'neutral',
        troops: 1,
        acted: false,
        shielded: false,
      };
      switch (ch) {
        case '.':
          break;
        case 'f':
          cell.terrain = 'forest';
          break;
        case 'h':
          cell.terrain = 'hill';
          break;
        case '~':
          cell.terrain = 'water';
          break;
        case 'v':
          cell.building = 'village';
          cell.troops = 3;
          break;
        case 'P':
        case 'A': {
          const side: Side = ch === 'P' ? 'player' : 'ai';
          cell.owner = side;
          cell.building = 'base';
          cell.troops = 5;
          bases[side] = id;
          break;
        }
        case 'p':
        case 'a':
          cell.owner = ch === 'p' ? 'player' : 'ai';
          cell.troops = 2;
          break;
        default:
          throw new Error(`${def.id}: unknown map char "${ch}"`);
      }
      if (cell.owner === 'neutral' && ch !== 'v') cell.troops = NEUTRAL_TROOPS[cell.terrain];
      cells[id] = cell;
      order.push(id);
    });
  });

  if (!bases.player || !bases.ai) throw new Error(`${def.id}: needs both P and A`);
  return { cells, order, bases: bases as Record<Side, string> };
}
