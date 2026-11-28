import type { CardDef, CardId } from './types';

/** Every card in the game. Unit numbers are tuned with scripts/mareas-balance.ts. */
export const CARDS: Record<CardId, CardDef> = {
  cangrejos: {
    id: 'cangrejos',
    name: 'Cangrejos',
    kind: 'creature',
    cost: 3,
    icon: '🦀',
    text: 'Tres cangrejos rápidos que pellizcan todo lo que encuentran.',
    needsLane: true,
    sea: 'laguna',
    unit: { hp: 130, dmg: 26, interval: 0.8, range: 0.035, speed: 0.105, count: 3 },
  },
  tortuga: {
    id: 'tortuga',
    name: 'Tortuga',
    kind: 'creature',
    cost: 4,
    icon: '🐢',
    text: 'Lenta y dura. Sabe nadar: la marea alta no la ahoga.',
    needsLane: true,
    sea: 'laguna',
    unit: { hp: 950, dmg: 45, interval: 1.2, range: 0.04, speed: 0.06, amphibious: true },
  },
  morsa: {
    id: 'morsa',
    name: 'Morsa',
    kind: 'creature',
    cost: 5,
    icon: '🦭',
    text: 'Golpea muy fuerte, pero se ahoga si la pilla la marea.',
    needsLane: true,
    sea: 'laguna',
    unit: { hp: 700, dmg: 110, interval: 1.2, range: 0.045, speed: 0.085 },
  },
  bote: {
    id: 'bote',
    name: 'Bote',
    kind: 'boat',
    cost: 2,
    icon: '🛶',
    text: 'Barquita rápida y barata. Navega con marea alta.',
    needsLane: true,
    sea: 'laguna',
    unit: { hp: 280, dmg: 38, interval: 0.9, range: 0.04, speed: 0.13 },
  },
  balandro: {
    id: 'balandro',
    name: 'Balandro',
    kind: 'boat',
    cost: 4,
    icon: '⛵',
    text: 'Velero con cañón: dispara desde lejos con marea alta.',
    needsLane: true,
    sea: 'laguna',
    unit: { hp: 520, dmg: 75, interval: 1.4, range: 0.2, speed: 0.09 },
  },
  puente: {
    id: 'puente',
    name: 'Puente',
    kind: 'build',
    cost: 3,
    icon: '🌉',
    text: 'Tus criaturas cruzan ese carril aunque suba la marea (30 s).',
    needsLane: true,
    sea: 'laguna',
  },
  dique: {
    id: 'dique',
    name: 'Dique',
    kind: 'build',
    cost: 2,
    icon: '🧱',
    text: 'Un muro en tu lado del carril que frena a los rivales.',
    needsLane: true,
    sea: 'laguna',
  },
  ola: {
    id: 'ola',
    name: 'Ola',
    kind: 'spell',
    cost: 3,
    icon: '🌊',
    text: 'Empuja hacia atrás a los rivales de un carril y les hace daño.',
    needsLane: true,
    sea: 'laguna',
  },
  pezglobo: {
    id: 'pezglobo',
    name: 'Pez globo',
    kind: 'creature',
    cost: 3,
    icon: '🐡',
    text: 'Corre y explota al tocar al primer rival. ¡Pum!',
    needsLane: true,
    sea: 'arrecife',
    unit: { hp: 220, dmg: 0, interval: 0.5, range: 0.035, speed: 0.12, explode: { dmg: 320, radius: 0.09 } },
  },
  erizos: {
    id: 'erizos',
    name: 'Erizos',
    kind: 'build',
    cost: 2,
    icon: '🦔',
    text: 'Pinchos en mitad del carril: hacen daño a las criaturas rivales.',
    needsLane: true,
    sea: 'arrecife',
  },
  galeon: {
    id: 'galeon',
    name: 'Galeón',
    kind: 'boat',
    cost: 6,
    icon: '🚢',
    text: 'Barco enorme con cañones. Lento, pero aguanta muchísimo.',
    needsLane: true,
    sea: 'arrecife',
    unit: { hp: 1400, dmg: 115, interval: 1.6, range: 0.22, speed: 0.06 },
  },
  mareaviva: {
    id: 'mareaviva',
    name: 'Marea viva',
    kind: 'spell',
    cost: 2,
    icon: '🌙',
    text: 'Cambia la marea ahora mismo. ¡Pilla al rival por sorpresa!',
    needsLane: false,
    sea: 'arrecife',
  },
};

export const ALL_CARDS = Object.keys(CARDS) as CardId[];

export const STARTER_DECK: CardId[] = ['cangrejos', 'tortuga', 'morsa', 'bote', 'balandro', 'puente', 'dique', 'ola'];

export const DECK_SIZE = 8;
export const HAND_SIZE = 4;
export const MAX_LEVEL = 5;

/** Each level adds 10% life and damage. */
export const levelBoost = (level = 1) => 1 + 0.1 * (Math.max(1, level) - 1);
/** Pearls to go from `level` to `level + 1`. */
export const upgradeCost = (level: number) => 30 * level;

export const KIND_LABEL: Record<CardDef['kind'], string> = {
  creature: 'Criatura · marea baja',
  boat: 'Barco · marea alta',
  build: 'Construcción',
  spell: 'Hechizo de marea',
};

/** Structure numbers. */
export const BRIDGE_TTL = 30;
export const WALL = { hp: 650, ttl: 40, d: 0.22 };
export const TRAP = { dps: 55, ttl: 25, d: 0.42, radius: 0.06 };
export const WAVE = { dmg: 90, push: 0.16 };
