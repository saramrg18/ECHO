import {
  CARDS,
  DECK_SIZE,
  SEAS,
  STARTER_DECK,
  TIDE_PERIOD,
  aiDeckFor,
  aiThink,
  applyResult,
  createBrain,
  createMatch,
  currentSea,
  deckError,
  initialSave,
  normalizeSave,
  playCard,
  step,
  unlockedCards,
  upgradeCard,
  type MatchState,
} from '..';

const make = (over: Partial<Parameters<typeof createMatch>[0]> = {}) =>
  createMatch({ sea: 'laguna', playerDeck: STARTER_DECK, aiDeck: aiDeckFor('laguna'), seed: 7, ...over });

const run = (s: MatchState, secs: number) => {
  for (let t = 0; t < secs; t += 0.05) step(s, 0.05);
};

/** Puts a card in the first hand slot and gives energy. */
function give(s: MatchState, card: keyof typeof CARDS) {
  s.players.player.hand[0] = card;
  s.players.player.energy = 10;
}

describe('tides', () => {
  it('switches every period', () => {
    const s = make();
    expect(s.tide).toBe('low');
    run(s, TIDE_PERIOD + 0.1);
    expect(s.tide).toBe('high');
    run(s, TIDE_PERIOD);
    expect(s.tide).toBe('low');
  });

  it('drowns creatures caught on the sand', () => {
    const s = make();
    give(s, 'morsa');
    run(s, 12);
    playCard(s, 'player', 0, 0);
    run(s, 9);
    const m = s.units.find((u) => u.card === 'morsa');
    expect(m?.state).toBe('drowning');
    run(s, 3);
    expect(s.units.find((u) => u.card === 'morsa')).toBeUndefined();
    expect(s.stats.drowned.player).toBe(1);
  });

  it('tortoises swim and bridges save creatures', () => {
    const s = make();
    give(s, 'tortuga');
    playCard(s, 'player', 0, 0);
    give(s, 'morsa');
    playCard(s, 'player', 0, 2);
    give(s, 'puente');
    playCard(s, 'player', 0, 2);
    run(s, 25);
    expect(s.units.find((u) => u.card === 'tortuga')).toBeDefined();
    expect(s.units.find((u) => u.card === 'morsa')?.state).not.toBe('drowning');
  });

  it('creatures played at high tide wait on the beach', () => {
    const s = make();
    run(s, TIDE_PERIOD + 1);
    give(s, 'morsa');
    playCard(s, 'player', 0, 1);
    run(s, 5);
    const m = s.units.find((u) => u.card === 'morsa')!;
    expect(m.state).toBe('wait');
    expect(m.d).toBeLessThan(0.06);
  });

  it('boats wait at low tide and get stranded when it falls', () => {
    const s = make();
    give(s, 'bote');
    playCard(s, 'player', 0, 1);
    run(s, 5);
    expect(s.units[0].state).toBe('wait');
    run(s, TIDE_PERIOD - 3);
    expect(s.units[0].state).toBe('move');
    // Sail for 3 seconds, then flip the tide to low with a surprise tide.
    run(s, 2);
    s.players.player.hand[1] = 'mareaviva';
    playCard(s, 'player', 1, null);
    run(s, 1);
    expect(s.units[0].state).toBe('stranded');
  });
});

describe('cards', () => {
  it('cycles the hand and spends energy', () => {
    const s = make();
    const p = s.players.player;
    const [first] = p.hand;
    const next = p.queue[0];
    p.energy = 10;
    expect(playCard(s, 'player', 0, 1)).toBeNull();
    expect(p.hand[0]).toBe(next);
    expect(p.queue[p.queue.length - 1]).toBe(first);
    expect(p.energy).toBe(10 - CARDS[first].cost);
  });

  it('refuses without energy', () => {
    const s = make();
    give(s, 'morsa');
    s.players.player.energy = 1;
    expect(playCard(s, 'player', 0, 1)).toBe('energy');
  });

  it('a wave pushes rivals back', () => {
    const s = make();
    s.players.ai.hand[0] = 'morsa';
    s.players.ai.energy = 10;
    playCard(s, 'ai', 0, 1);
    run(s, 6);
    const before = s.units[0].d;
    give(s, 'ola');
    playCard(s, 'player', 0, 1);
    expect(s.units[0].d).toBeGreaterThan(before);
  });

  it('every card has a sea and every sea card exists', () => {
    for (const sea of SEAS) for (const c of sea.cards) expect(CARDS[c].sea).toBe(sea.id);
    expect(STARTER_DECK).toHaveLength(DECK_SIZE);
  });
});

describe('matches', () => {
  it('AI vs AI always ends within the time limit', () => {
    for (let seed = 1; seed <= 5; seed++) {
      const s = make({ seed });
      const a = createBrain(2);
      const b = createBrain(2);
      let guard = 0;
      while (!s.result && guard++ < 10000) {
        aiThink(s, a, 0.05, 'player');
        aiThink(s, b, 0.05);
        step(s, 0.05);
      }
      expect(s.result).not.toBeNull();
      expect(s.time).toBeLessThanOrEqual(181);
    }
  });

  it('the guided match starts with a passive rival and full energy', () => {
    const s = make({ tutorial: true });
    expect(s.aiActive).toBe(false);
    expect(s.players.player.energy).toBe(10);
    expect(s.players.player.hand).toEqual(STARTER_DECK.slice(0, 4));
    const brain = createBrain(1);
    aiThink(s, brain, 5);
    expect(s.units).toHaveLength(0);
  });
});

describe('progress', () => {
  it('wins give shells and pearls and open the next sea', () => {
    let save = initialSave();
    expect(unlockedCards(save.shells)).toHaveLength(8);
    let newSea = null;
    for (let i = 0; i < 4; i++) {
      const r = applyResult(save, 'win');
      save = r.save;
      newSea = r.reward.newSea ?? newSea;
    }
    expect(save.shells).toBe(120);
    expect(newSea).toBe('arrecife');
    expect(currentSea(save.shells).id).toBe('arrecife');
    expect(unlockedCards(save.shells)).toHaveLength(12);
    // Losing never drops you out of a sea you reached.
    save = applyResult(save, 'lose').save;
    expect(save.shells).toBe(120);
  });

  it('upgrades cost pearls', () => {
    const save = { ...initialSave(), pearls: 35 };
    const up = upgradeCard(save, 'cangrejos')!;
    expect(up.levels.cangrejos).toBe(2);
    expect(up.pearls).toBe(5);
    expect(upgradeCard(up, 'cangrejos')).toBeNull();
  });

  it('validates decks and repairs bad saves', () => {
    const save = initialSave();
    expect(deckError(save, STARTER_DECK)).toBeNull();
    expect(deckError(save, STARTER_DECK.slice(0, 7))).toMatch(/8 cartas/);
    expect(deckError(save, [...STARTER_DECK.slice(0, 7), 'galeon'])).toMatch(/aún no/);
    const fixed = normalizeSave({ shells: -3, decks: [['cangrejos', 'nope']] });
    expect(fixed.shells).toBe(0);
    expect(fixed.decks[0]).toEqual(['cangrejos']);
    expect(fixed.decks).toHaveLength(3);
  });
});
