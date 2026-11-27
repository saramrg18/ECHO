import { applyMove, createInitialState, nextHint, parseLevel, playMoves, previewMove, solve, starsFor, type GameState } from '..';

const lvl = parseLevel({ id: 'p', name: 'p', map: ['#######', '#S....#', '#.....#', '#....E#', '#######'] });

describe('stars', () => {
  it('gives 3 stars at par, 2 within the margin, 1 beyond', () => {
    expect(starsFor(10, 10)).toBe(3);
    expect(starsFor(9, 10)).toBe(3);
    expect(starsFor(13, 10)).toBe(2);
    expect(starsFor(14, 10)).toBe(1);
    expect(starsFor(6, 4)).toBe(2);
    expect(starsFor(7, 4)).toBe(1);
    expect(starsFor(50, undefined)).toBe(3);
  });
});

describe('preview', () => {
  it('matches what the move actually does, including the echo, without changing state', () => {
    const s = playMoves(lvl, ['right', 'down', 'right']);
    const p = previewMove(s, 'down')!;
    const real = applyMove(s, 'down').state as GameState;
    expect(p.final).toEqual(real.player);
    expect(p.steps.map((e) => e.actor)).toEqual(['player', 'echo']);
    expect(s.turn).toBe(3);
  });

  it('returns null for a blocked move', () => {
    expect(previewMove(createInitialState(lvl), 'up')).toBeNull();
  });
});

describe('hints', () => {
  it('following the hints always wins in the optimal number of moves', () => {
    let s = createInitialState(lvl);
    let n = 0;
    while (s.status === 'playing' && n < 50) {
      const h = nextHint(s);
      if (h.kind !== 'move') throw new Error('stuck');
      s = applyMove(s, h.dir).state;
      n++;
    }
    expect(s.status).toBe('won');
    expect(n).toBe(solve(lvl).solution!.length);
  });

  it('reports when the level can no longer be won', () => {
    const trap = parseLevel({ id: 't', name: 't', map: ['######', '#S%.E#', '######'] });
    // step onto crumble then back: it collapses behind us
    const s = playMoves(trap, ['right', 'left']);
    expect(nextHint(s)).toEqual({ kind: 'stuck' });
  });
});
