/** Player progress: pure functions, persisted by ProgressProvider. */

export interface LevelRecord {
  /** Fewest moves used to complete the level. */
  readonly bestMoves: number;
}

export interface Progress {
  readonly version: 1;
  /** Levels that can be played. */
  readonly unlocked: readonly string[];
  /** Completed levels with their best result. */
  readonly completed: Readonly<Record<string, LevelRecord>>;
  /** Last level the player opened, for "Jugar" / continue. */
  readonly lastPlayed?: string;
}

export function initialProgress(levelOrder: readonly string[]): Progress {
  return { version: 1, unlocked: levelOrder.slice(0, 1), completed: {} };
}

/** Repairs stored data against the current level list (levels may be added later). */
export function normalizeProgress(raw: unknown, levelOrder: readonly string[]): Progress {
  const base = initialProgress(levelOrder);
  if (!raw || typeof raw !== 'object' || (raw as Progress).version !== 1) return base;
  const p = raw as Progress;
  const known = new Set(levelOrder);
  const completed: Record<string, LevelRecord> = {};
  for (const [id, rec] of Object.entries(p.completed ?? {})) {
    if (known.has(id) && rec && Number.isFinite(rec.bestMoves)) completed[id] = { bestMoves: rec.bestMoves };
  }
  const unlocked = new Set<string>(base.unlocked);
  for (const id of p.unlocked ?? []) if (known.has(id)) unlocked.add(id);
  // Every level after a completed one is unlocked.
  levelOrder.forEach((id, i) => {
    if (completed[id] && levelOrder[i + 1]) unlocked.add(levelOrder[i + 1]);
  });
  return {
    version: 1,
    unlocked: levelOrder.filter((id) => unlocked.has(id)),
    completed,
    lastPlayed: p.lastPlayed && known.has(p.lastPlayed) ? p.lastPlayed : undefined,
  };
}

export function recordCompletion(p: Progress, levelOrder: readonly string[], id: string, moves: number): Progress {
  const prev = p.completed[id];
  const completed = { ...p.completed, [id]: { bestMoves: prev ? Math.min(prev.bestMoves, moves) : moves } };
  const idx = levelOrder.indexOf(id);
  const next = idx >= 0 ? levelOrder[idx + 1] : undefined;
  const unlocked = next && !p.unlocked.includes(next) ? [...p.unlocked, next] : p.unlocked;
  return { ...p, completed, unlocked: levelOrder.filter((l) => unlocked.includes(l)) };
}

export function isUnlocked(p: Progress, id: string): boolean {
  return p.unlocked.includes(id);
}

/** Level to open with "Jugar": the last played if still unfinished, else the first unfinished unlocked one. */
export function continueLevel(p: Progress, levelOrder: readonly string[]): string {
  if (p.lastPlayed && !p.completed[p.lastPlayed]) return p.lastPlayed;
  return levelOrder.find((id) => isUnlocked(p, id) && !p.completed[id]) ?? p.lastPlayed ?? levelOrder[0];
}

export function completedCount(p: Progress): number {
  return Object.keys(p.completed).length;
}
