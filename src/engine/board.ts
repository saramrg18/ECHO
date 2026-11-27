import type { Board, Tile, Vec } from './types';

const VOID: Tile = { kind: 'void' };

export function inBounds(board: Board, pos: Vec): boolean {
  return pos.x >= 0 && pos.y >= 0 && pos.x < board.width && pos.y < board.height;
}

export function indexOf(board: Board, pos: Vec): number {
  return pos.y * board.width + pos.x;
}

export function posOf(board: Board, index: number): Vec {
  return { x: index % board.width, y: Math.floor(index / board.width) };
}

export function tileAt(board: Board, pos: Vec): Tile {
  return inBounds(board, pos) ? board.tiles[indexOf(board, pos)] : VOID;
}
