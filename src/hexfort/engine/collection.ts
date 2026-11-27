/** Campaign progress, card collection and deck building. Pure data, persisted by the app. */
import { ALL_CARDS, DECK_SIZE, MAX_COPIES, STARTER_COLLECTION, STARTER_DECK } from './cards';
import { CAMPAIGN, type MapDef } from './maps';
import type { CardId } from './types';

export interface HexSave {
  version: 1;
  won: string[];
  collection: Partial<Record<CardId, number>>;
  deck: CardId[];
}

export function initialSave(): HexSave {
  return {
    version: 1,
    won: [],
    collection: { ...STARTER_COLLECTION },
    deck: STARTER_DECK.slice(),
  };
}

export function normalizeSave(raw: unknown): HexSave {
  const base = initialSave();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<HexSave>;
  const won = Array.isArray(r.won) ? r.won.filter((id) => CAMPAIGN.some((m) => m.id === id)) : [];
  const collection: Partial<Record<CardId, number>> = { ...base.collection };
  if (r.collection && typeof r.collection === 'object') {
    for (const id of ALL_CARDS) {
      const n = (r.collection as Record<string, unknown>)[id];
      if (typeof n === 'number' && n >= 0) collection[id] = Math.min(MAX_COPIES, Math.floor(n));
    }
  }
  const save: HexSave = { version: 1, won, collection, deck: base.deck };
  if (Array.isArray(r.deck) && deckError(r.deck as CardId[], collection) === null) save.deck = r.deck as CardId[];
  return save;
}

export const owned = (save: HexSave, id: CardId) => save.collection[id] ?? 0;

export function isUnlocked(save: HexSave, mapId: string): boolean {
  const i = CAMPAIGN.findIndex((m) => m.id === mapId);
  if (i <= 0) return true;
  return save.won.includes(CAMPAIGN[i - 1].id);
}

export function deckError(deck: CardId[], collection: Partial<Record<CardId, number>>): string | null {
  if (deck.length !== DECK_SIZE) return `El mazo debe tener ${DECK_SIZE} cartas.`;
  const counts: Partial<Record<CardId, number>> = {};
  for (const c of deck) {
    if (!ALL_CARDS.includes(c)) return 'Carta desconocida.';
    counts[c] = (counts[c] ?? 0) + 1;
    if (counts[c]! > (collection[c] ?? 0)) return 'No tienes suficientes copias de esa carta.';
  }
  return null;
}

/** Records a win and returns the save plus the cards newly unlocked. */
export function recordWin(save: HexSave, map: MapDef): { save: HexSave; unlocked: CardId[] } {
  if (save.won.includes(map.id) || map.reward.length === 0) return { save, unlocked: [] };
  const collection = { ...save.collection };
  for (const c of map.reward) collection[c] = Math.min(MAX_COPIES, (collection[c] ?? 0) + 1);
  return {
    save: { ...save, won: [...save.won, map.id], collection },
    unlocked: map.reward,
  };
}

/** The rival's deck gets stronger as the campaign progresses. */
export function aiDeckFor(map: MapDef): CardId[] {
  const index = CAMPAIGN.findIndex((m) => m.id === map.id);
  const deck: CardId[] = STARTER_DECK.slice();
  const extras: CardId[][] = [
    [],
    ['fireball'],
    ['fireball', 'shield'],
    ['fireball', 'shield', 'catapult'],
    ['fireball', 'shield', 'catapult', 'rally', 'quake'],
  ];
  const add = index === -1 ? ['fireball', 'shield', 'catapult'] : (extras[index] ?? []);
  // Replace starter cards from the end so the deck stays 12 cards.
  add.forEach((c, i) => (deck[deck.length - 1 - i] = c as CardId));
  return deck;
}
