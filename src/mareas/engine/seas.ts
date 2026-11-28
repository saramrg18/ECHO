import type { CardId, SeaId } from './types';

export interface SeaDef {
  id: SeaId;
  name: string;
  /** Trophy shells needed to reach it. */
  shells: number;
  /** Cards you unlock on reaching it. */
  cards: CardId[];
  /** The twist this sea adds, in plain words. */
  twist: string;
  /** Rival card level and skill. */
  aiLevel: number;
  /** Rival energy speed (below 1 = easier). */
  aiEnergy: number;
  /** Not built yet. */
  comingSoon?: boolean;
  colors: { water: string; deep: string; sand: string; grass: string; sky: string };
}

export const SEAS: SeaDef[] = [
  {
    id: 'laguna',
    name: 'Laguna',
    shells: 0,
    cards: ['cangrejos', 'tortuga', 'morsa', 'bote', 'balandro', 'puente', 'dique', 'ola'],
    twist: 'Aguas tranquilas para aprender las mareas.',
    aiLevel: 1,
    aiEnergy: 0.8,
    colors: { water: '#38C6E0', deep: '#1A8FC0', sand: '#F3D99B', grass: '#7CCB5B', sky: '#9ADCF5' },
  },
  {
    id: 'arrecife',
    name: 'Arrecife',
    shells: 120,
    cards: ['pezglobo', 'erizos', 'galeon', 'mareaviva'],
    twist: 'Coral en el carril central: araña a los barcos que pasan por encima.',
    aiLevel: 2,
    aiEnergy: 0.95,
    colors: { water: '#2FD3C4', deep: '#138A9E', sand: '#FBE3B0', grass: '#5FC28A', sky: '#A6EAF0' },
  },
  {
    id: 'manglar',
    name: 'Manglar',
    shells: 350,
    cards: [],
    twist: 'Raíces que atrapan barcos y esconden criaturas.',
    aiLevel: 3,
    aiEnergy: 1,
    comingSoon: true,
    colors: { water: '#5DAF8C', deep: '#2F6E5A', sand: '#C9B27A', grass: '#4E9A4A', sky: '#B6DDB8' },
  },
  {
    id: 'hielo',
    name: 'Hielo',
    shells: 650,
    cards: [],
    twist: 'Témpanos que flotan y sirven de puente.',
    aiLevel: 4,
    aiEnergy: 1,
    comingSoon: true,
    colors: { water: '#7FC4E8', deep: '#3D7FB0', sand: '#E8F2F8', grass: '#CFE6F0', sky: '#D6ECF7' },
  },
  {
    id: 'volcan',
    name: 'Volcán',
    shells: 1000,
    cards: [],
    twist: 'Ríos de lava que secan el agua de un carril.',
    aiLevel: 5,
    aiEnergy: 1,
    comingSoon: true,
    colors: { water: '#E0704A', deep: '#8A2E1E', sand: '#5A4A44', grass: '#3E3432', sky: '#F2B28A' },
  },
  {
    id: 'abismo',
    name: 'Abismo',
    shells: 1400,
    cards: [],
    twist: 'Mareas que cambian sin avisar en la oscuridad.',
    aiLevel: 5,
    aiEnergy: 1,
    comingSoon: true,
    colors: { water: '#2A3D8F', deep: '#111A45', sand: '#5E6A9E', grass: '#3A4A80', sky: '#4A5AA8' },
  },
];

export const seaById = (id: SeaId) => SEAS.find((s) => s.id === id)!;

/** Highest playable sea reached with these shells. */
export function currentSea(shells: number): SeaDef {
  let best = SEAS[0];
  for (const s of SEAS) if (!s.comingSoon && shells >= s.shells) best = s;
  return best;
}

export function seaReached(shells: number, id: SeaId): boolean {
  const s = seaById(id);
  return !s.comingSoon && shells >= s.shells;
}

/** Cards owned with this many shells. */
export function unlockedCards(shells: number): CardId[] {
  return SEAS.filter((s) => seaReached(shells, s.id)).flatMap((s) => s.cards);
}

/** What the rival plays in each sea. */
export function aiDeckFor(sea: SeaId): CardId[] {
  if (sea === 'arrecife') return ['cangrejos', 'pezglobo', 'morsa', 'bote', 'galeon', 'puente', 'erizos', 'mareaviva'];
  return ['cangrejos', 'tortuga', 'morsa', 'bote', 'balandro', 'puente', 'dique', 'ola'];
}
