import { parseLevel, playMoves, solve } from '../../engine';
import { ALL_LEVELS, LEVEL_ORDER, WORLDS } from '..';

describe('level catalogue', () => {
  it('has 30 levels in 3 blocks of 10 with unique ids', () => {
    expect(WORLDS).toHaveLength(3);
    WORLDS.forEach((w) => expect(w.levels).toHaveLength(10));
    expect(new Set(LEVEL_ORDER).size).toBe(30);
  });

  it('the first levels work as a tutorial (have hints)', () => {
    ALL_LEVELS.slice(0, 5).forEach((l) => expect(l.hint).toBeTruthy());
  });

  describe.each(ALL_LEVELS.map((l) => [l.id, l.name, l] as const))('level %s (%s)', (_id, _name, def) => {
    it('is solvable within its move limit, and the solution replays to a win', () => {
      const level = parseLevel(def);
      const { solution } = solve(level);
      expect(solution).not.toBeNull();
      if (def.maxMoves !== undefined) expect(solution!.length).toBeLessThanOrEqual(def.maxMoves);
      expect(playMoves(level, solution!).status).toBe('won');
      // par drives the star rating, so it must be the true optimum
      expect(def.par).toBe(solution!.length);
    });
  });

  it('difficulty grows: each block needs more moves on average than the previous one', () => {
    const avg = WORLDS.map(
      (w) => w.levels.reduce((s, l) => s + solve(parseLevel(l)).solution!.length, 0) / w.levels.length,
    );
    expect(avg[0]).toBeLessThan(avg[1]);
    expect(avg[1]).toBeLessThan(avg[2]);
  });
});
