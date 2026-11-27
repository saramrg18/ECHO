import type { BuildingKind, CardId } from './types';

/**
 * What a card can target:
 * - own-empty: one of your cells without a building (towers)
 * - own: any of your cells
 * - foe: an enemy or neutral cell
 * - foe-building: an enemy cell with a tower
 * - none: no target
 */
export type CardTarget = 'own-empty' | 'own' | 'foe' | 'foe-building' | 'none';

export interface CardDef {
  id: CardId;
  name: string;
  cost: number;
  kind: 'tower' | 'spell';
  target: CardTarget;
  text: string;
  builds?: BuildingKind;
}

export const CARDS: Record<CardId, CardDef> = {
  guard: {
    id: 'guard',
    name: 'Torre de guardia',
    cost: 2,
    kind: 'tower',
    target: 'own-empty',
    builds: 'guard',
    text: '+2 de defensa en esta casilla.',
  },
  archer: {
    id: 'archer',
    name: 'Torre de arqueros',
    cost: 3,
    kind: 'tower',
    target: 'own-empty',
    builds: 'archer',
    text: 'Al acabar tu turno quita 1 tropa a cada casilla enemiga vecina.',
  },
  barracks: {
    id: 'barracks',
    name: 'Cuartel',
    cost: 3,
    kind: 'tower',
    target: 'own-empty',
    builds: 'barracks',
    text: '+1 tropa aquí al empezar tu turno.',
  },
  mine: {
    id: 'mine',
    name: 'Mina de cristal',
    cost: 2,
    kind: 'tower',
    target: 'own-empty',
    builds: 'mine',
    text: '+1 de energía al empezar tu turno.',
  },
  catapult: {
    id: 'catapult',
    name: 'Catapulta',
    cost: 4,
    kind: 'tower',
    target: 'own-empty',
    builds: 'catapult',
    text: 'Al acabar tu turno quita 2 tropas a la casilla enemiga más fuerte a 2 de distancia.',
  },
  reinforce: {
    id: 'reinforce',
    name: 'Refuerzos',
    cost: 1,
    kind: 'spell',
    target: 'own',
    text: '+3 tropas en una casilla tuya.',
  },
  fireball: {
    id: 'fireball',
    name: 'Bola de fuego',
    cost: 3,
    kind: 'spell',
    target: 'foe',
    text: 'Quita 4 tropas a una casilla rival o neutral.',
  },
  shield: {
    id: 'shield',
    name: 'Escudo',
    cost: 2,
    kind: 'spell',
    target: 'own',
    text: 'Nadie puede atacar esta casilla hasta tu próximo turno.',
  },
  rally: {
    id: 'rally',
    name: 'Grito de guerra',
    cost: 2,
    kind: 'spell',
    target: 'none',
    text: 'Todas tus casillas pueden volver a moverse este turno.',
  },
  quake: {
    id: 'quake',
    name: 'Terremoto',
    cost: 3,
    kind: 'spell',
    target: 'foe-building',
    text: 'Destruye una torre rival.',
  },
};

export const ALL_CARDS = Object.keys(CARDS) as CardId[];

export const STARTER_COLLECTION: Partial<Record<CardId, number>> = {
  guard: 3,
  archer: 2,
  barracks: 2,
  mine: 2,
  reinforce: 3,
};

export const DECK_SIZE = 12;
export const MAX_COPIES = 3;

export const STARTER_DECK: CardId[] = [
  'guard',
  'guard',
  'archer',
  'archer',
  'barracks',
  'barracks',
  'mine',
  'mine',
  'reinforce',
  'reinforce',
  'reinforce',
  'guard',
];

export interface SynergyDef {
  id: string;
  name: string;
  /** The building that gets the bonus... */
  building: BuildingKind;
  /** ...when it has at least one neighbouring own building of this kind. */
  partner: BuildingKind;
  text: string;
}

export const SYNERGIES: SynergyDef[] = [
  {
    id: 'wall',
    name: 'Muralla',
    building: 'guard',
    partner: 'guard',
    text: 'Guardia junto a guardia: +1 de defensa.',
  },
  {
    id: 'fort',
    name: 'Fortín',
    building: 'archer',
    partner: 'guard',
    text: 'Arqueros junto a guardia: disparan 1 más.',
  },
  {
    id: 'camp',
    name: 'Campamento',
    building: 'barracks',
    partner: 'barracks',
    text: 'Cuartel junto a cuartel: +1 tropa.',
  },
  {
    id: 'forge',
    name: 'Armería',
    building: 'barracks',
    partner: 'mine',
    text: 'Cuartel junto a mina: +1 tropa.',
  },
  {
    id: 'vein',
    name: 'Filón',
    building: 'mine',
    partner: 'mine',
    text: 'Mina junto a mina: +1 de energía.',
  },
  {
    id: 'artillery',
    name: 'Artillería',
    building: 'catapult',
    partner: 'archer',
    text: 'Catapulta junto a arqueros: +1 de daño.',
  },
];

export const BUILDING_NAMES: Record<BuildingKind, string> = {
  base: 'Castillo',
  village: 'Aldea',
  guard: 'Torre de guardia',
  archer: 'Torre de arqueros',
  barracks: 'Cuartel',
  mine: 'Mina de cristal',
  catapult: 'Catapulta',
};
