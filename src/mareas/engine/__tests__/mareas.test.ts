import {
  CARDS,
  HOME,
  findPath,
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

const CENTER = 4;
const RIVAL = 1;

describe('tides and islands', () => {
  it('switches every period and picks new sandbars for each low tide', () => {
    const s = make();
    const first = [...s.openBars];
    expect(s.tide).toBe('low');
    run(s, TIDE_PERIOD + 0.1);
    expect(s.tide).toBe('high');
    expect(s.openBars).not.toEqual(first);
    // Always a way across.
    expect(findPath(s.map, HOME.player, HOME.ai, (b) => s.openBars.includes(b.id))).not.toBeNull();
    run(s, TIDE_PERIOD);
    expect(s.tide).toBe('low');
  });

  it('open sandbars are mirror-fair', () => {
    for (let seed = 1; seed < 30; seed++) {
      const s = make({ seed });
      const mirror: Record<number, number> = { 0: 1, 1: 0, 2: 3, 3: 2, 4: 5, 5: 4, 6: 7, 7: 6, 8: 9, 9: 8 };
      for (const b of s.openBars) expect(s.openBars).toContain(mirror[b]);
    }
  });

  it('creatures walk to an island, conquer it and stay', () => {
    const s = make({ tutorial: true });
    give(s, 'morsa');
    playCard(s, 'player', 0, CENTER);
    run(s, 15);
    const m = s.units.find((u) => u.card === 'morsa')!;
    expect(m.node).toBe(CENTER);
    expect(s.islands[CENTER].owner).toBe('player');
  });

  it('drowns creatures caught on a sandbar', () => {
    const s = make({ tutorial: true });
    run(s, 16);
    give(s, 'morsa');
    playCard(s, 'player', 0, RIVAL);
    run(s, 6);
    expect(s.units.find((u) => u.card === 'morsa')?.state).toBe('drowning');
    run(s, 3);
    expect(s.units.find((u) => u.card === 'morsa')).toBeUndefined();
    expect(s.stats.drowned.player).toBe(1);
  });

  it('a bridge saves creatures and lets them cross at high tide', () => {
    const s = make({ tutorial: true });
    run(s, TIDE_PERIOD + 2);
    give(s, 'puente');
    playCard(s, 'player', 0, 2);
    give(s, 'morsa');
    playCard(s, 'player', 0, 2);
    run(s, 8);
    const m = s.units.find((u) => u.card === 'morsa')!;
    expect(m.node).toBe(2);
    expect(m.state).not.toBe('drowning');
  });

  it('creatures with no open way wait at home; tortoises swim', () => {
    const s = make({ tutorial: true });
    run(s, TIDE_PERIOD + 2);
    give(s, 'morsa');
    playCard(s, 'player', 0, CENTER);
    give(s, 'tortuga');
    playCard(s, 'player', 0, CENTER);
    run(s, 4);
    expect(s.units.find((u) => u.card === 'morsa')!.state).toBe('wait');
    expect(s.units.find((u) => u.card === 'tortuga')!.next).not.toBeNull();
  });

  it('boats wait at low tide, sail at high tide and run aground when it falls', () => {
    const s = make({ tutorial: true });
    give(s, 'bote');
    playCard(s, 'player', 0, RIVAL);
    run(s, 5);
    expect(s.units[0].state).toBe('wait');
    run(s, TIDE_PERIOD - 3);
    expect(s.units[0].state).toBe('move');
    run(s, 0.5);
    s.players.player.hand[1] = 'mareaviva';
    s.players.player.energy = 10;
    playCard(s, 'player', 1, null);
    run(s, 1.5);
    expect(s.units[0].state).toBe('stranded');
  });

  it('owning a Perla island gives extra energy', () => {
    const a = make({ tutorial: true });
    const b = make({ tutorial: true });
    a.players.player.energy = b.players.player.energy = 0;
    b.islands[CENTER].owner = 'player';
    b.islands[CENTER].capture = 1;
    run(a, 4);
    run(b, 4);
    expect(b.players.player.energy).toBeGreaterThan(a.players.player.energy + 0.5);
  });
});

describe('cards', () => {
  it('cycles the hand and spends energy', () => {
    const s = make();
    const p = s.players.player;
    const [first] = p.hand;
    const next = p.queue[0];
    p.energy = 10;
    expect(playCard(s, 'player', 0, CENTER)).toBeNull();
    expect(p.hand[0]).toBe(next);
    expect(p.queue[p.queue.length - 1]).toBe(first);
    expect(p.energy).toBe(10 - CARDS[first].cost);
  });

  it('refuses without energy or without a target', () => {
    const s = make();
    give(s, 'morsa');
    expect(playCard(s, 'player', 0, null)).toBe('target');
    s.players.player.energy = 1;
    expect(playCard(s, 'player', 0, CENTER)).toBe('energy');
  });

  it('a wave hurts and pushes rivals back', () => {
    const s = make({ tutorial: true });
    s.aiActive = true;
    s.players.ai.hand[0] = 'morsa';
    s.players.ai.energy = 10;
    playCard(s, 'ai', 0, HOME.player);
    run(s, 10);
    const m = s.units[0];
    const before = Math.hypot(m.x, m.z - 10.2);
    const hp = m.hp;
    give(s, 'ola');
    playCard(s, 'player', 0, CENTER);
    expect(m.hp).toBeLessThan(hp);
    expect(Math.hypot(m.x, m.z - 10.2)).toBeGreaterThan(before);
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
