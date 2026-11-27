/**
 * Turns data-defined levels (ASCII maps) into immutable Level objects.
 *
 * Legend:
 *   ' '  void (outside the board, not drawn)
 *   '#'  wall
 *   '.'  floor
 *   'S'  player start (floor)
 *   'E'  exit
 *   'a'..'d'  switch of group a..d (toggles doors of the same group)
 *   'A'..'D'  door of group a..d, initially closed
 *   '1'..'4'  door of group a..d, initially open
 *   '%'  crumbling floor (collapses after the piece leaves it)
 *   '*'  silence tile (erases all pending echoes)
 *   '^' '>' 'v' '<'  one-way tile (enter only in that direction)
 */
import type { Board, Level, LevelDefinition, Tile, Vec } from './types';

const glyphs = new Map<string, Tile>();

export function registerGlyph(char: string, tile: Tile): void {
  if (char.length !== 1) throw new Error('Glyph must be a single character');
  glyphs.set(char, tile);
}

registerGlyph(' ', { kind: 'void' });
registerGlyph('#', { kind: 'wall' });
registerGlyph('.', { kind: 'floor' });
registerGlyph('S', { kind: 'floor' });
registerGlyph('E', { kind: 'exit' });
registerGlyph('%', { kind: 'crumble' });
registerGlyph('*', { kind: 'silence' });
registerGlyph('^', { kind: 'oneway', dir: 'up' });
registerGlyph('>', { kind: 'oneway', dir: 'right' });
registerGlyph('v', { kind: 'oneway', dir: 'down' });
registerGlyph('<', { kind: 'oneway', dir: 'left' });
'abcd'.split('').forEach((g, i) => {
  registerGlyph(g, { kind: 'switch', group: g });
  registerGlyph(g.toUpperCase(), { kind: 'door', group: g, initiallyOpen: false });
  registerGlyph(String(i + 1), { kind: 'door', group: g, initiallyOpen: true });
});

export const DEFAULT_ECHO_DELAY = 3;

export function parseLevel(def: LevelDefinition): Level {
  if (def.map.length === 0) throw new Error(`Level ${def.id}: empty map`);
  const height = def.map.length;
  const width = Math.max(...def.map.map((r) => r.length));
  const tiles: Tile[] = [];
  let start: Vec | null = null;
  let exits = 0;

  for (let y = 0; y < height; y++) {
    const row = def.map[y].padEnd(width, ' ');
    for (let x = 0; x < width; x++) {
      const ch = row[x];
      const tile = glyphs.get(ch);
      if (!tile) throw new Error(`Level ${def.id}: unknown glyph "${ch}" at ${x},${y}`);
      if (ch === 'S') {
        if (start) throw new Error(`Level ${def.id}: multiple starts`);
        start = { x, y };
      }
      if (tile.kind === 'exit') exits++;
      tiles.push(tile);
    }
  }
  if (!start) throw new Error(`Level ${def.id}: missing start "S"`);
  if (exits === 0) throw new Error(`Level ${def.id}: missing exit "E"`);

  const echoDelay = def.echoDelay ?? DEFAULT_ECHO_DELAY;
  if (!Number.isInteger(echoDelay) || echoDelay < 1) {
    throw new Error(`Level ${def.id}: echoDelay must be a positive integer`);
  }

  const board: Board = { width, height, tiles };
  return {
    id: def.id,
    name: def.name,
    board,
    start,
    echoDelay,
    maxMoves: def.maxMoves,
    hint: def.hint,
    par: def.par,
  };
}
