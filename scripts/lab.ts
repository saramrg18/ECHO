// Level lab: prints solver stats for draft maps. Usage: npx tsx scripts/lab.ts <file.json>
import { readFileSync } from 'fs';
import { parseLevel, solve, playMoves, type LevelDefinition, type Direction } from '../src/engine';

const arrows: Record<Direction, string> = { up: '↑', down: '↓', left: '←', right: '→' };
const defs: LevelDefinition[] = JSON.parse(readFileSync(process.argv[2], 'utf8'));
for (const def of defs) {
  const lvl = parseLevel(def);
  const t0 = Date.now();
  const r = solve(lvl);
  const ms = Date.now() - t0;
  // plain path ignoring echoes (delay huge)
  const plain = solve(parseLevel({ ...def, echoDelay: 999, maxMoves: undefined }));
  const sol = r.solution;
  console.log(
    `${def.id.padEnd(6)} opt=${sol ? sol.length : 'NONE'} plain=${plain.solution?.length ?? 'NONE'} states=${r.explored} ${ms}ms  ${sol ? sol.map((d) => arrows[d]).join('') : ''}`,
  );
  if (sol) {
    const s = playMoves(lvl, sol);
    if (s.status !== 'won') console.log('  !! replay did not win');
  }
}
