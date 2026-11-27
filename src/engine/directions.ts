import type { Direction, Vec } from './types';

export const DIRECTIONS: readonly Direction[] = ['up', 'right', 'down', 'left'];

const DELTAS: Record<Direction, Vec> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export function delta(dir: Direction): Vec {
  return DELTAS[dir];
}

export function translate(pos: Vec, dir: Direction): Vec {
  const d = DELTAS[dir];
  return { x: pos.x + d.x, y: pos.y + d.y };
}

export function opposite(dir: Direction): Direction {
  switch (dir) {
    case 'up':
      return 'down';
    case 'down':
      return 'up';
    case 'left':
      return 'right';
    case 'right':
      return 'left';
  }
}

export function samePos(a: Vec, b: Vec): boolean {
  return a.x === b.x && a.y === b.y;
}
