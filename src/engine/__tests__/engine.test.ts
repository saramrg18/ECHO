import {
  applyMove,
  createInitialState,
  createSession,
  parseLevel,
  playMoves,
  restart,
  sessionMove,
  solve,
  undo,
  upcomingEchoes,
  type Direction,
  type GameState,
} from '..';

const open = parseLevel({
  id: 't-open',
  name: 'open',
  map: [
    '#########',
    '#.......#',
    '#.......#',
    '#...S...#',
    '#.......#',
    '#......E#',
    '#########',
  ],
});

function play(level = open, moves: Direction[]): GameState {
  return playMoves(level, moves);
}

describe('echo / repeat mechanic', () => {
  it('repeats turn 1 on turn 4 and turn 2 on turn 5 (spec example)', () => {
    // start (4,3)
    let s = play(open, ['right', 'up', 'left']);
    expect(s.player).toEqual({ x: 4, y: 2 });
    expect(s.lastSteps.map((e) => e.actor)).toEqual(['player']);

    s = applyMove(s, 'down').state as GameState; // turn 4: down + echo of turn 1 (right)
    expect(s.lastSteps.map((e) => [e.actor, e.dir, e.sourceTurn])).toEqual([
      ['player', 'down', undefined],
      ['echo', 'right', 1],
    ]);
    expect(s.player).toEqual({ x: 5, y: 3 });

    s = applyMove(s, 'down').state as GameState; // turn 5: down + echo of turn 2 (up)
    expect(s.lastSteps[1]).toMatchObject({ actor: 'echo', dir: 'up', sourceTurn: 2 });
    expect(s.player).toEqual({ x: 5, y: 3 });
  });

  it('an echo is replayed exactly once', () => {
    let s = play(open, ['right', 'up', 'left', 'down']);
    expect(s.echoQueue.map((e) => e.sourceTurn)).toEqual([2, 3, 4]);
    s = play(open, ['right', 'up', 'left', 'down', 'down', 'down', 'down']);
    const echoes = s.lastSteps.filter((e) => e.actor === 'echo');
    expect(echoes).toHaveLength(1);
    expect(echoes[0].sourceTurn).toBe(4);
  });

  it('skips an echo that hits a wall', () => {
    const lvl = parseLevel({ id: 'w', name: 'w', map: ['#####', '#S..#', '#...#', '#..E#', '#####'] });
    // right, right, down, then turn 4: up back to (3,1); echo 'right' hits the wall
    const s = play(lvl, ['right', 'right', 'down', 'up']);
    expect(s.lastSteps[1]).toMatchObject({ actor: 'echo', dir: 'right', blocked: true });
    expect(s.player).toEqual({ x: 3, y: 1 });
  });

  it('rejects a player move into a wall without consuming a turn', () => {
    const lvl = parseLevel({ id: 'w', name: 'w', map: ['####', '#SE#', '####'] });
    const r = applyMove(createInitialState(lvl), 'up');
    expect(r.accepted).toBe(false);
    expect(r.state.turn).toBe(0);
  });

  it('respects a custom echo delay', () => {
    const lvl = parseLevel({ id: 'd', name: 'd', echoDelay: 2, map: ['#######', '#S....#', '#....E#', '#######'] });
    const s = play(lvl, ['right', 'down', 'left']);
    expect(s.lastSteps[1]).toMatchObject({ actor: 'echo', dir: 'right', sourceTurn: 1 });
  });

  it('lists upcoming echoes soonest first', () => {
    const s = play(open, ['right', 'up', 'left']);
    expect(upcomingEchoes(s).map((e) => [e.dir, e.turnsUntil])).toEqual([
      ['right', 1],
      ['up', 2],
      ['left', 3],
    ]);
  });
});

describe('board elements', () => {
  it('wins when the player reaches the exit', () => {
    const lvl = parseLevel({ id: 'e', name: 'e', map: ['#####', '#S.E#', '#####'] });
    const s = play(lvl, ['right', 'right']);
    expect(s.status).toBe('won');
    expect(applyMove(s, 'left')).toMatchObject({ accepted: false, reason: 'finished' });
  });

  it('wins when an echo carries the player onto the exit', () => {
    const lvl = parseLevel({ id: 'e', name: 'e', map: ['######', '#..E.#', '#S...#', '#....#', '######'] });
    // up, right, down, then turn 4: player right -> echo up -> ... let's verify via steps
    const s2 = play(lvl, ['up', 'right', 'down', 'right']);
    // turn 4: player right (3,2) then echo 'up' -> (3,1) = exit
    expect(s2.lastSteps.map((e) => e.actor)).toEqual(['player', 'echo']);
    expect(s2.status).toBe('won');
  });

  it('switches toggle doors, also when triggered by an echo', () => {
    const lvl = parseLevel({ id: 's', name: 's', map: ['#######', '#Sa.AE#', '#######'] });
    expect(applyMove(createInitialState(lvl), 'right').accepted).toBe(true);
    // Stepping on switch a once opens A
    let s = play(lvl, ['right']);
    expect(s.toggledGroups).toEqual(['a']);
    s = play(lvl, ['right', 'right', 'right']);
    expect(s.player).toEqual({ x: 4, y: 1 });

    // echo re-enters the switch and closes the door again
    const lvl2 = parseLevel({ id: 's2', name: 's2', map: ['########', '#S.a.AE#', '#......#', '########'] });
    // right, right(on a: open), left, turn4: down + echo right(3,2)->no switch
    const t = play(lvl2, ['right', 'right', 'left', 'right']);
    // turn 4: player right -> (3,1) switch (close), echo right -> (4,1)
    expect(t.lastSteps[0].effects).toEqual(['toggle:a']);
    expect(t.toggledGroups).toEqual([]);
  });

  it('open doors start open and close with their switch', () => {
    const lvl = parseLevel({ id: 'o', name: 'o', map: ['######', '#S.1E#', '#.a..#', '######'] });
    expect(play(lvl, ['right', 'right']).player).toEqual({ x: 3, y: 1 });
    const s = play(lvl, ['down', 'right', 'up']); // turn 2 steps on a: door closes
    expect(applyMove(s, 'right').accepted).toBe(false);
  });

  it('crumbling floor collapses after leaving it', () => {
    const lvl = parseLevel({ id: 'c', name: 'c', map: ['######', '#S%.E#', '######'] });
    const s = play(lvl, ['right', 'right']);
    expect(s.collapsed).toHaveLength(1);
    expect(applyMove(s, 'left').accepted).toBe(false);
  });

  it('one-way tiles can only be entered in their direction', () => {
    const lvl = parseLevel({ id: 'w', name: 'w', map: ['#####', '#S>E#', '#####'] });
    expect(play(lvl, ['right', 'right']).status).toBe('won');
    const lvl2 = parseLevel({ id: 'w2', name: 'w2', map: ['#####', '#S<E#', '#####'] });
    expect(applyMove(createInitialState(lvl2), 'right').accepted).toBe(false);
  });

  it('silence tile erases all pending echoes', () => {
    const lvl = parseLevel({ id: 'q', name: 'q', map: ['#######', '#S.*.E#', '#######'] });
    const s = play(lvl, ['right', 'right']);
    expect(s.echoQueue).toEqual([]);
    expect(s.lastSteps[0].effects).toEqual(['silence']);
  });

  it('loses when the move limit is reached', () => {
    const lvl = parseLevel({ id: 'm', name: 'm', maxMoves: 2, map: ['######', '#S...#', '#...E#', '######'] });
    const s = play(lvl, ['right', 'left']);
    expect(s.status).toBe('lost');
  });
});

describe('session: undo and restart', () => {
  it('undo restores the exact previous state, including echoes and doors', () => {
    const lvl = parseLevel({ id: 's', name: 's', map: ['#######', '#Sa.AE#', '#.....#', '#######'] });
    let session = createSession(lvl);
    const moves: Direction[] = ['right', 'down', 'right', 'up'];
    const snapshots: GameState[] = [session.current];
    for (const m of moves) {
      session = sessionMove(session, m).session;
      snapshots.push(session.current);
    }
    for (let i = moves.length - 1; i >= 0; i--) {
      session = undo(session);
      const { lastSteps: _a, ...cur } = session.current;
      const { lastSteps: _b, ...exp } = snapshots[i];
      expect(cur).toEqual(exp);
    }
    expect(undo(session)).toBe(session);
  });

  it('rejected moves are not added to history', () => {
    const lvl = parseLevel({ id: 'w', name: 'w', map: ['####', '#SE#', '####'] });
    const { session } = sessionMove(createSession(lvl), 'up');
    expect(session.history).toHaveLength(0);
  });

  it('restart goes back to the initial state', () => {
    let session = createSession(open);
    session = sessionMove(session, 'right').session;
    session = restart(session);
    expect(session.current).toEqual(createInitialState(open));
    expect(session.history).toHaveLength(0);
  });
});

describe('level parser', () => {
  it('rejects invalid levels', () => {
    expect(() => parseLevel({ id: 'x', name: 'x', map: ['#.E#'] })).toThrow(/start/);
    expect(() => parseLevel({ id: 'x', name: 'x', map: ['#S.#'] })).toThrow(/exit/);
    expect(() => parseLevel({ id: 'x', name: 'x', map: ['#S?E#'] })).toThrow(/glyph/);
  });
});

describe('solver', () => {
  it('finds the optimal solution and it actually wins', () => {
    const r = solve(open);
    expect(r.solution).not.toBeNull();
    expect(play(open, r.solution!).status).toBe('won');
  });

  it('reports unsolvable levels', () => {
    const lvl = parseLevel({ id: 'u', name: 'u', map: ['#######', '#S.#.E#', '#######'] });
    expect(solve(lvl).solution).toBeNull();
  });
});
