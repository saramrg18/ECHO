/** Level catalogue. Levels are pure data; see engine/level-parser.ts for the map legend. */
import { parseLevel, type Level, type LevelDefinition } from '../engine';
import type { WorldDefinition } from './types';
import { world1 } from './world1';
import { world2 } from './world2';
import { world3 } from './world3';

export type { WorldDefinition } from './types';

export const WORLDS: readonly WorldDefinition[] = [world1, world2, world3];
export const ALL_LEVELS: readonly LevelDefinition[] = WORLDS.flatMap((w) => w.levels);
export const LEVEL_ORDER: readonly string[] = ALL_LEVELS.map((l) => l.id);

const cache = new Map<string, Level>();

export function getLevel(id: string): Level | undefined {
  const cached = cache.get(id);
  if (cached) return cached;
  const def = ALL_LEVELS.find((l) => l.id === id);
  if (!def) return undefined;
  const lvl = parseLevel(def);
  cache.set(id, lvl);
  return lvl;
}

export function levelNumber(id: string): number {
  return LEVEL_ORDER.indexOf(id) + 1;
}

export function nextLevelId(id: string): string | undefined {
  const i = LEVEL_ORDER.indexOf(id);
  return i >= 0 ? LEVEL_ORDER[i + 1] : undefined;
}

export function worldOf(id: string): WorldDefinition | undefined {
  return WORLDS.find((w) => w.levels.some((l) => l.id === id));
}
