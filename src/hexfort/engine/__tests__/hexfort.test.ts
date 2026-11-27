import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  ALL_MAPS,
  CAMPAIGN,
  DECK_SIZE,
  STARTER_DECK,
  activeSynergies,
  aiDeckFor,
  applyAction,
  createMatch,
  deckError,
  defenseOf,
  hexId,
  hexToWorld,
  initialSave,
  isUnlocked,
  neighborIds,
  normalizeSave,
  parseMap,
  planAiTurn,
  recordWin,
  worldToHex,
  type MatchState,
} from '..';

const m1 = CAMPAIGN[0];
const newMatch = (seed = 1) =>
  createMatch({
    map: m1,
    playerDeck: STARTER_DECK,
    aiDeck: aiDeckFor(m1),
    seed,
  });

/** Small helper to set up a custom board situation. */
function edit(state: MatchState, id: string, patch: Partial<MatchState['cells'][string]>) {
  state.cells[id] = { ...state.cells[id], ...patch };
}

describe('hex math', () => {
  it('round-trips world coordinates', () => {
    for (let q = -4; q <= 4; q++)
      for (let r = -4; r <= 4; r++) {
        const w = hexToWorld({ q, r }, 1.1);
        expect(worldToHex(w.x + 0.2, w.z - 0.2, 1.1)).toEqual({ q, r });
      }
  });
  it('has six neighbours', () => {
    expect(neighborIds(hexId(0, 0))).toHaveLength(6);
  });
});

describe('maps', () => {
  it.each(ALL_MAPS.map((m) => [m.id, m]))('%s parses and both bases are connected by land', (_, map) => {
    const { cells, bases } = parseMap(map);
    const seen = new Set([bases.player]);
    const queue = [bases.player];
    while (queue.length) {
      const id = queue.shift()!;
      for (const n of neighborIds(id)) {
        if (cells[n] && cells[n].terrain !== 'water' && !seen.has(n)) {
          seen.add(n);
          queue.push(n);
        }
      }
    }
    expect(seen.has(bases.ai)).toBe(true);
  });
});

describe('rules', () => {
  it('starts on the player turn with troops to place and a hand', () => {
    const s = newMatch();
    expect(s.turn).toBe('player');
    expect(s.sides.player.pool).toBeGreaterThan(0);
    expect(s.sides.player.hand).toHaveLength(4);
    expect(s.sides.player.energy).toBe(3);
  });

  it('places troops only on own cells', () => {
    const s = newMatch();
    const base = s.bases.player;
    const before = s.cells[base].troops;
    const ok = applyAction(s, { type: 'place', cell: base, amount: 2 });
    expect(ok.error).toBeUndefined();
    expect(ok.state.cells[base].troops).toBe(before + 2);
    expect(applyAction(s, { type: 'place', cell: s.bases.ai }).error).toBeDefined();
  });

  it('captures a neutral cell when attack beats defence', () => {
    const s = newMatch();
    const base = s.bases.player;
    const target = neighborIds(base).find((id) => s.cells[id]?.owner === 'neutral' && s.cells[id].terrain === 'plain')!;
    edit(s, base, { troops: 5 });
    const r = applyAction(s, { type: 'move', from: base, to: target });
    expect(r.error).toBeUndefined();
    expect(r.state.cells[target].owner).toBe('player');
    expect(r.state.cells[target].troops).toBe(4 - 1);
    expect(r.state.cells[base].troops).toBe(1);
    expect(r.events[0]).toMatchObject({ type: 'battle', captured: true });
    // Each cell moves only once per turn.
    expect(applyAction(r.state, { type: 'move', from: target, to: base }).error).toBeDefined();
  });

  it('a failed attack wears down the defender but keeps ownership', () => {
    const s = newMatch();
    const base = s.bases.player;
    const target = neighborIds(base).find((id) => s.cells[id]?.owner === 'neutral')!;
    edit(s, target, { troops: 6, terrain: 'plain' });
    edit(s, base, { troops: 4 });
    const r = applyAction(s, { type: 'move', from: base, to: target });
    expect(r.state.cells[target].owner).toBe('neutral');
    expect(r.state.cells[target].troops).toBe(3);
  });

  it('guard towers add defence and get the Muralla synergy next to another guard', () => {
    const s = newMatch();
    const base = s.bases.player;
    const [a, b] = neighborIds(base).filter((id) => s.cells[id]);
    edit(s, a, {
      owner: 'player',
      troops: 1,
      terrain: 'plain',
      building: 'guard',
    });
    expect(defenseOf(s, a)).toBe(3);
    edit(s, b, {
      owner: 'player',
      troops: 1,
      terrain: 'plain',
      building: 'guard',
    });
    // a and b are both neighbours of the base; check they are also neighbours of each other.
    if (neighborIds(a).includes(b)) {
      expect(activeSynergies(s, a).map((x) => x.id)).toContain('wall');
      expect(defenseOf(s, a)).toBe(4);
    }
  });

  it('playing a tower card spends energy and builds', () => {
    const s = newMatch();
    s.sides.player.hand = ['guard'];
    const target = neighborIds(s.bases.player).find((id) => s.cells[id])!;
    edit(s, target, { owner: 'player' });
    const r = applyAction(s, { type: 'card', index: 0, target });
    expect(r.error).toBeUndefined();
    expect(r.state.cells[target].building).toBe('guard');
    expect(r.state.sides.player.energy).toBe(1);
    expect(r.state.sides.player.hand).toHaveLength(0);
    expect(applyAction(s, { type: 'card', index: 0, target: s.bases.ai }).error).toBeDefined();
  });

  it('archer towers shoot adjacent enemies when the turn ends', () => {
    const s = newMatch();
    const base = s.bases.player;
    const [a, b] = neighborIds(base).filter((id) => s.cells[id]);
    const foe = neighborIds(a).find((id) => s.cells[id] && id !== base && id !== b)!;
    edit(s, a, { owner: 'player', building: 'archer', troops: 1 });
    edit(s, foe, { owner: 'ai', troops: 3, building: undefined });
    const r = applyAction(s, { type: 'end' });
    expect(r.events.some((e) => e.type === 'shot' && e.to === foe)).toBe(true);
    expect(r.state.cells[foe].troops).toBe(2);
    expect(r.state.turn).toBe('ai');
  });

  it('capturing the rival castle wins the match', () => {
    const s = newMatch();
    const aiBase = s.bases.ai;
    const from = neighborIds(aiBase).find((id) => s.cells[id] && s.cells[id].terrain !== 'water')!;
    edit(s, from, { owner: 'player', troops: 30, acted: false });
    const r = applyAction(s, { type: 'move', from, to: aiBase });
    expect(r.state.winner).toBe('player');
    expect(applyAction(r.state, { type: 'end' }).error).toBeDefined();
  });

  it('shielded cells cannot be attacked', () => {
    const s = newMatch();
    const base = s.bases.player;
    const target = neighborIds(base).find((id) => s.cells[id])!;
    edit(s, target, { owner: 'ai', shielded: true });
    edit(s, base, { troops: 10 });
    expect(applyAction(s, { type: 'move', from: base, to: target }).error).toMatch(/escudo/);
  });

  it('is deterministic for a given seed', () => {
    expect(newMatch(42).sides.player.hand).toEqual(newMatch(42).sides.player.hand);
  });
});

/** Plays a whole match with the AI controlling both sides. */
function selfPlay(mapIndex: number, seed: number) {
  const map = ALL_MAPS[mapIndex];
  let s = createMatch({
    map,
    playerDeck: aiDeckFor(map),
    aiDeck: aiDeckFor(map),
    seed,
  });
  let guard = 0;
  while (!s.winner && guard++ < 2000) {
    for (const a of planAiTurn(s)) {
      const r = applyAction(s, a);
      expect(r.error).toBeUndefined();
      s = r.state;
      if (s.winner) break;
    }
  }
  return s;
}

describe('ai', () => {
  it.each(ALL_MAPS.map((m, i) => [m.id, i]))('%s: AI vs AI matches always finish with valid actions', (_, i) => {
    for (const seed of [1, 2, 3]) {
      const end = selfPlay(i as number, seed);
      expect(end.winner).toBeDefined();
    }
  });

  it('beats a player who never does anything', () => {
    let s = newMatch(7);
    while (!s.winner) {
      s = applyAction(s, { type: 'end' }).state;
      if (s.winner) break;
      for (const a of planAiTurn(s)) {
        s = applyAction(s, a).state;
        if (s.winner) break;
      }
    }
    expect(s.winner).toBe('ai');
  });
});

describe('collection', () => {
  it('starter deck is legal and campaign unlocks in order', () => {
    const save = initialSave();
    expect(STARTER_DECK).toHaveLength(DECK_SIZE);
    expect(deckError(save.deck, save.collection)).toBeNull();
    expect(isUnlocked(save, 'm1')).toBe(true);
    expect(isUnlocked(save, 'm2')).toBe(false);
    const { save: after, unlocked } = recordWin(save, CAMPAIGN[0]);
    expect(unlocked).toEqual(['fireball', 'fireball']);
    expect(after.collection.fireball).toBe(2);
    expect(isUnlocked(after, 'm2')).toBe(true);
    expect(recordWin(after, CAMPAIGN[0]).unlocked).toEqual([]);
  });

  it('rejects illegal decks and recovers from corrupt saves', () => {
    const save = initialSave();
    expect(deckError(['fireball', ...save.deck.slice(1)], save.collection)).toMatch(/copias/);
    expect(deckError(save.deck.slice(1), save.collection)).toMatch(/12/);
    expect(normalizeSave('nope')).toEqual(initialSave());
    expect(normalizeSave({ won: ['m1', 'zzz'], deck: ['x'] }).won).toEqual(['m1']);
  });
});

it('engine has no UI or platform imports', () => {
  const dir = join(__dirname, '..');
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.ts'))) {
    expect(readFileSync(join(dir, f), 'utf8')).not.toMatch(/from ['"](react|react-native|expo|three)[^'"]*['"]/);
  }
});
