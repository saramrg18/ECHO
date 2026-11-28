/** What MAREAS remembers between matches: shells, pearls, card levels and 3 decks. */
import { ALL_CARDS, DECK_SIZE, MAX_LEVEL, STARTER_DECK, upgradeCost } from './cards';
import { SEAS, currentSea, unlockedCards } from './seas';
import type { CardId, Result, SeaId } from './types';

export interface MareasSave {
  shells: number;
  pearls: number;
  levels: Partial<Record<CardId, number>>;
  decks: CardId[][];
  activeDeck: number;
  tutorialDone: boolean;
  wins: number;
  losses: number;
}

export const DECK_SLOTS = 3;

export const initialSave = (): MareasSave => ({
  shells: 0,
  pearls: 0,
  levels: {},
  decks: [[...STARTER_DECK], [...STARTER_DECK], [...STARTER_DECK]],
  activeDeck: 0,
  tutorialDone: false,
  wins: 0,
  losses: 0,
});

export function normalizeSave(raw: unknown): MareasSave {
  const base = initialSave();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<MareasSave>;
  const num = (v: unknown, d: number) => (typeof v === 'number' && isFinite(v) && v >= 0 ? v : d);
  const decks = Array.isArray(r.decks) ? r.decks : base.decks;
  return {
    shells: num(r.shells, 0),
    pearls: num(r.pearls, 0),
    levels: typeof r.levels === 'object' && r.levels ? r.levels : {},
    decks: Array.from({ length: DECK_SLOTS }, (_, i) =>
      Array.isArray(decks[i]) ? decks[i].filter((c): c is CardId => ALL_CARDS.includes(c)) : [...STARTER_DECK],
    ),
    activeDeck: Math.min(DECK_SLOTS - 1, Math.floor(num(r.activeDeck, 0))),
    tutorialDone: r.tutorialDone === true,
    wins: num(r.wins, 0),
    losses: num(r.losses, 0),
  };
}

export function deckError(save: MareasSave, deck: CardId[]): string | null {
  if (deck.length !== DECK_SIZE) return `El mazo necesita ${DECK_SIZE} cartas (tiene ${deck.length}).`;
  const owned = unlockedCards(save.shells);
  if (deck.some((c) => !owned.includes(c))) return 'Hay cartas que aún no tienes.';
  if (new Set(deck).size !== deck.length) return 'No se puede repetir carta.';
  return null;
}

/** The deck the player takes into a match (falls back to the starter one if invalid). */
export function playableDeck(save: MareasSave): CardId[] {
  const d = save.decks[save.activeDeck];
  return deckError(save, d) ? [...STARTER_DECK] : d;
}

export interface Reward {
  shells: number;
  pearls: number;
  newSea: SeaId | null;
  newCards: CardId[];
}

export const REWARD: Record<Result, { shells: number; pearls: number }> = {
  win: { shells: 30, pearls: 25 },
  draw: { shells: 0, pearls: 10 },
  lose: { shells: -10, pearls: 5 },
};

export function applyResult(save: MareasSave, result: Result, tutorial = false): { save: MareasSave; reward: Reward } {
  const r = REWARD[result];
  const before = currentSea(save.shells);
  // Never drop below the sea you already reached.
  const floor = before.shells;
  const shells = Math.max(floor, save.shells + r.shells);
  const next: MareasSave = {
    ...save,
    shells,
    pearls: save.pearls + r.pearls,
    wins: save.wins + (result === 'win' ? 1 : 0),
    losses: save.losses + (result === 'lose' ? 1 : 0),
    tutorialDone: save.tutorialDone || tutorial,
  };
  const after = currentSea(shells);
  const newSea = after.id !== before.id ? after.id : null;
  return {
    save: next,
    reward: {
      shells: shells - save.shells,
      pearls: r.pearls,
      newSea,
      newCards: newSea ? SEAS.find((s) => s.id === newSea)!.cards : [],
    },
  };
}

export const cardLevel = (save: MareasSave, id: CardId) => save.levels[id] ?? 1;

export function upgradeCard(save: MareasSave, id: CardId): MareasSave | null {
  const lv = cardLevel(save, id);
  const cost = upgradeCost(lv);
  if (lv >= MAX_LEVEL || save.pearls < cost || !unlockedCards(save.shells).includes(id)) return null;
  return { ...save, pearls: save.pearls - cost, levels: { ...save.levels, [id]: lv + 1 } };
}
