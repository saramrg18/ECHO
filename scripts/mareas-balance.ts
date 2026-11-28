/** Plays many headless AI-vs-AI MAREAS matches and prints how they end. Run: npx tsx scripts/mareas-balance.ts */
import {
  STARTER_DECK,
  seaById,
  aiDeckFor,
  aiThink,
  createBrain,
  createMatch,
  step,
  type MatchState,
} from '../src/mareas/engine';

function run(seed: number, pl: number, al: number, sea: 'laguna' | 'arrecife', deck = STARTER_DECK) {
  const s: MatchState = createMatch({
    sea,
    playerDeck: deck,
    aiDeck: aiDeckFor(sea),
    seed,
    aiEnergyRate: seaById(sea).aiEnergy,
  });
  const a = createBrain(pl);
  const b = createBrain(al);
  let plays = 0;
  while (!s.result) {
    aiThink(s, a, 0.05, 'player');
    aiThink(s, b, 0.05, 'ai');
    plays += s.events.filter((e) => e.type === 'play').length;
    step(s, 0.05);
    s.events = [];
  }
  return { s, plays };
}

for (const [pl, al, sea] of [
  [2, 2, 'laguna'],
  [2, 1, 'laguna'],
  [3, 2, 'arrecife'],
] as const) {
  const tally = { win: 0, lose: 0, draw: 0 };
  let time = 0;
  let drowned = 0;
  let stranded = 0;
  let plays = 0;
  let ko = 0;
  let hp = 0;
  const N = 60;
  for (let i = 0; i < N; i++) {
    const { s, plays: p } = run(i + 1, pl, al, sea);
    tally[s.result!]++;
    time += s.time;
    drowned += s.stats.drowned.player + s.stats.drowned.ai;
    stranded += s.stats.stranded.player + s.stats.stranded.ai;
    plays += p;
    if (s.players.player.lighthouse <= 0 || s.players.ai.lighthouse <= 0) ko++;
    hp += Math.min(s.players.player.lighthouse, s.players.ai.lighthouse);
  }
  console.log(
    `${sea} L${pl} vs L${al}:`,
    tally,
    `avg ${(time / N).toFixed(0)}s, KO ${ko}/${N}, plays/match ${(plays / N).toFixed(0)}, drowned ${(drowned / N).toFixed(1)}, stranded ${(stranded / N).toFixed(1)}, minHP ${(hp / N).toFixed(0)}`,
  );
}
